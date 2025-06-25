import * as admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

// addAdminRole function is correct and remains unchanged
interface AddAdminRoleData {
    email: string;
}
interface CustomDecodedIdToken extends DecodedIdToken {
    isAdmin?: boolean;
}
export const addAdminRole = onCall<AddAdminRoleData>(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be authenticated to call this function.");
    }
    const token = request.auth.token as CustomDecodedIdToken;
    if (token.isAdmin !== true) {
        throw new HttpsError("permission-denied", "Only an admin can perform this action.");
    }
    const email = request.data.email;
    if (typeof email !== "string" || email.length === 0) {
        throw new HttpsError("invalid-argument", "The function must be called with a valid email address.");
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
        return { message: `Success! ${email} has been made an admin.` };
    } catch (error: unknown) {
        console.error("Error setting custom claim:", error);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found') {
            throw new HttpsError("not-found", "No user account was found for this email address.");
        }
        throw new HttpsError("internal", "An unexpected error occurred while processing your request.");
    }
});


interface GetFeedbackSummaryData {
    employeeId: string;
    timeFrame: "daily" | "monthly";
}

function getGeminiKey(): string {
    const key = process.env.GEMINI_KEY;
    if (!key) {
        throw new Error("Gemini API Key (GEMINI_KEY) is not configured in the function's environment.");
    }
    return key;
}

function parseCustomDate(dateString: string): Date | null {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split(' ');
    if (parts.length < 1) return null;
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return null;
    const month = parseInt(dateParts[0], 10) - 1;
    const day = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    return date;
}

export const getFeedbackSummary = onCall<GetFeedbackSummaryData>(
    { timeoutSeconds: 120, memory: "512MiB", secrets: ["GEMINI_KEY"] },
    async (request) => {
        if (request.auth?.token.isAdmin !== true) {
            throw new HttpsError("permission-denied", "Only an admin can perform this action.");
        }

        const { employeeId, timeFrame } = request.data;
        try {
            const employeeDoc = await admin.firestore().collection("employees").doc(employeeId).get();
            if (!employeeDoc.exists) {
                throw new HttpsError("not-found", "Employee not found in Firestore.");
            }
            const sheetUrl = employeeDoc.data()?.feedback_sheet_url;
            if (!sheetUrl) {
                throw new HttpsError("not-found", "Feedback sheet URL not configured for this employee.");
            }
            const spreadsheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!spreadsheetIdMatch || !spreadsheetIdMatch[1]) {
                throw new HttpsError("invalid-argument", "Invalid Google Sheet URL format.");
            }
            const spreadsheetId = spreadsheetIdMatch[1];

            const auth = new GoogleAuth({
                scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
            });
            const sheets = google.sheets({ version: "v4", auth });
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: "Sheet1!A:D",
            });
            const rows = response.data.values;
            if (!rows || rows.length < 2) {
                return { positiveComments: [], improvementAreas: [], graphData: null };
            }

            const allRecords = rows.slice(1);
            const now = new Date();

            const filteredRecords = allRecords.filter(row => {
                if (!row || !row[0]) return false;
                const timestamp = parseCustomDate(row[0]);
                if (!timestamp) return false;

                if (timeFrame === "daily") {
                    return timestamp.toDateString() === now.toDateString();
                } else {
                    return timestamp.getMonth() === now.getMonth() && timestamp.getFullYear() === now.getFullYear();
                }
            });

            if (filteredRecords.length === 0) {
                return { positiveComments: [], improvementAreas: [], graphData: null };
            }

            let totalUnderstanding = 0;
            let totalInstructor = 0;
            const allComments = [];

            for (const row of filteredRecords) {
                if (!Array.isArray(row)) continue;
                totalUnderstanding += Number(row[1]) || 0;
                totalInstructor += Number(row[2]) || 0;
                const commentForAI = row[3] || "";
                if (commentForAI && commentForAI.toLowerCase().trim() !== 'na' && commentForAI.trim().length > 0) {
                    allComments.push(commentForAI);
                }
            }

            const avgUnderstanding = filteredRecords.length > 0 ? totalUnderstanding / filteredRecords.length : 0;
            const avgInstructor = filteredRecords.length > 0 ? totalInstructor / filteredRecords.length : 0;

            const graphData = {
                totalFeedbacks: filteredRecords.length,
                avgUnderstanding: parseFloat(avgUnderstanding.toFixed(2)),
                avgInstructor: parseFloat(avgInstructor.toFixed(2)),
            };

            let summary = { positiveFeedback: [], improvementAreas: [] };
            if (allComments.length > 0) {
                const genAI = new GoogleGenerativeAI(getGeminiKey());
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                // --- NEW, MORE DETAILED PROMPT FOR THE AI ---
                const prompt = `From the following list of verbatim feedback comments, perform an analysis. Return a valid JSON object with two keys: "positiveFeedback" and "improvementAreas".
              For "positiveFeedback", return an array of up to 3 objects, where each object has a "quote" key (the verbatim positive comment) and a "keywords" key (an array of 1-3 relevant keywords from the quote).
              For "improvementAreas", return an array of up to 3 objects, where each object has a "theme" key (a summarized topic like 'Pacing' or 'Interaction') and a "suggestion" key (a concise, actionable suggestion for the instructor).
              If there are no comments that fit a category, return an empty array for that key.
              Comments: """${allComments.join("\n")}"""`;

                const result = await model.generateContent(prompt);
                const rawResponse = result.response.text();
                const startIndex = rawResponse.indexOf('{');
                const endIndex = rawResponse.lastIndexOf('}');
                const jsonText = rawResponse.substring(startIndex, endIndex + 1);
                summary = JSON.parse(jsonText);
            }

            return {
                positiveFeedback: summary.positiveFeedback || [],
                improvementAreas: summary.improvementAreas || [],
                graphData,
            };
        } catch (error) {
            console.error("Error in getFeedbackSummary function:", error);
            throw new HttpsError("internal", "An error occurred while fetching the feedback summary. Check the function logs for details.");
        }
    }
);