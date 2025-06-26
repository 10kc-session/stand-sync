import * as admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { parse, isSameDay, isSameMonth, startOfDay, parseISO } from "date-fns";

admin.initializeApp();

// Helper to load Gemini key
function getGeminiKey(): string {
    const key = process.env.GEMINI_KEY;
    if (!key) throw new Error("GEMINI_KEY not set.");
    return key;
}

// --- 1) Grant admin role ---
interface AddAdminRoleData { email: string; }
interface CustomDecodedIdToken extends DecodedIdToken { isAdmin?: boolean; }

export const addAdminRole = onCall<AddAdminRoleData>(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const caller = request.auth.token as CustomDecodedIdToken;
    if (!caller.isAdmin) throw new HttpsError("permission-denied", "Admins only.");

    const email = request.data.email?.trim();
    if (!email) {
        throw new HttpsError("invalid-argument", "Provide a valid email.");
    }

    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
        return { message: `${email} is now an admin.` };
    } catch (err: any) {
        if (err.code === "auth/user-not-found") {
            throw new HttpsError("not-found", "User not found.");
        }
        console.error("addAdminRole error:", err);
        throw new HttpsError("internal", "Could not set admin role.");
    }
});

// --- 2) Fetch feedback summary (daily, monthly, specific) ---
interface GetFeedbackSummaryData {
    employeeId: string;
    timeFrame: "daily" | "monthly" | "specific";
    date?: string;  // client sends ISO string, e.g. "2025-06-20T00:00:00.000Z"
}

export const getFeedbackSummary = onCall<GetFeedbackSummaryData>(
    { timeoutSeconds: 120, memory: "512MiB", secrets: ["GEMINI_KEY", "SHEETS_SA_KEY"] },
    async (request) => {
        if (request.auth?.token.isAdmin !== true) {
            throw new HttpsError("permission-denied", "Admins only.");
        }

        const { employeeId, timeFrame, date: isoDateString } = request.data;
        if (!employeeId) {
            throw new HttpsError("invalid-argument", "Missing employeeId.");
        }

        try {
            const empDoc = await admin.firestore().collection("employees").doc(employeeId).get();
            if (!empDoc.exists) throw new HttpsError("not-found", "Employee not found.");
            const sheetUrl = empDoc.data()?.feedback_sheet_url;
            if (typeof sheetUrl !== "string") {
                throw new HttpsError("not-found", "No feedback sheet for this employee.");
            }
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) throw new HttpsError("invalid-argument", "Invalid Sheet URL.");
            const spreadsheetId = match[1];

            const saKeyRaw = process.env.SHEETS_SA_KEY;
            if (!saKeyRaw) throw new HttpsError("internal", "SHEETS_SA_KEY not set.");
            const saKey = JSON.parse(saKeyRaw);
            const jwtClient = new JWT({
                email: saKey.client_email,
                key: saKey.private_key,
                scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
            });
            const sheets = google.sheets({ version: "v4", auth: jwtClient });

            const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Sheet1!A:D" });
            const rows = resp.data.values;
            if (!rows || rows.length < 2) {
                return { positiveFeedback: [], improvementAreas: [], graphData: null };
            }

            const now = new Date();
            const today0 = startOfDay(now);
            let target0: Date | null = null;
            if (timeFrame === "specific" && isoDateString) {
                target0 = startOfDay(parseISO(isoDateString));
            }

            const dataRows = rows.slice(1);
            const filtered = dataRows.filter(row => {
                const ts = row[0]?.toString().trim();
                if (!ts) return false;
                const sheetDt = parse(ts, "M/d/yyyy H:mm:ss", new Date());
                if (isNaN(sheetDt.getTime())) return false;
                if (timeFrame === "daily") return isSameDay(sheetDt, today0);
                if (timeFrame === "specific" && target0) return isSameDay(sheetDt, target0);
                return isSameMonth(sheetDt, today0);
            });

            if (filtered.length === 0) {
                return { positiveFeedback: [], improvementAreas: [], graphData: null };
            }

            let sumU = 0, sumI = 0;
            const comments: string[] = [];
            const skip = ["na", "n/a", "none", "ntg", "nil", ""];
            for (const r of filtered) {
                sumU += Number(r[1]) || 0;
                sumI += Number(r[2]) || 0;
                const txt = (r[3] || "").toString().trim();
                if (txt && !skip.includes(txt.toLowerCase())) {
                    comments.push(txt);
                }
            }

            const avgU = parseFloat((sumU / filtered.length).toFixed(2));
            const avgI = parseFloat((sumI / filtered.length).toFixed(2));
            const graphData = {
                totalFeedbacks: filtered.length,
                avgUnderstanding: avgU,
                avgInstructor: avgI,
            };

            let positive: { quote: string; keywords: string[] }[] = [];
            let improve: { theme: string; suggestion: string }[] = [];

            if (comments.length) {
                const genAI = new GoogleGenerativeAI(getGeminiKey());
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `From the following list of verbatim feedback comments, perform an analysis. Return a valid JSON object with two keys: "positiveFeedback" and "improvementAreas". For "positiveFeedback", return an array of up to 3 objects, where each object has a "quote" key (the verbatim positive comment) and a "keywords" key (an array of 1-3 relevant keywords from the quote). For "improvementAreas", return an array of up to 3 objects, where each object has a "theme" key (a summarized topic like 'Pacing' or 'Interaction') and a "suggestion" key (a concise, actionable suggestion for the instructor). If there are no comments that fit a category, return an empty array for that key. Comments: """${comments.join("\n")}"""`;

                const res = await model.generateContent(prompt);
                const txt = await res.response.text();

                // --- FINAL FIX: Add a try/catch block around JSON.parse ---
                try {
                    const js = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
                    if (js) { // Only parse if the extracted text is not empty
                        const obj = JSON.parse(js);
                        positive = obj.positiveFeedback || [];
                        improve = obj.improvementAreas || [];
                    }
                } catch (e) {
                    console.error("AI response parse error. The AI may have returned a non-JSON response due to safety settings or empty input. Falling back to empty summary.", e, "Raw AI response:", txt);
                    // Leave positive and improve as empty arrays
                }
            }

            return { positiveFeedback: positive, improvementAreas: improve, graphData };
        } catch (error) {
            console.error("Error in getFeedbackSummary function:", error);
            throw new HttpsError("internal", "An error occurred. Check function logs.");
        }
    }
);
