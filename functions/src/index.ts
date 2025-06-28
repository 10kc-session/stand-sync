import * as admin from "firebase-admin";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DecodedIdToken } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
    parse,
    isSameDay,
    isSameMonth,
    startOfDay,
    endOfDay,
    parseISO,
    format,
    isValid
} from "date-fns";

admin.initializeApp();

function getGeminiKey(): string {
    const key = process.env.GEMINI_KEY;
    if (!key) throw new Error("GEMINI_KEY not set.");
    return key;
}

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

// --- MODIFICATION START 1: The new flexible date parsing function ---
/**
 * Tries to parse a date string using a list of supported formats.
 * @param dateString The raw date string from the Google Sheet.
 * @returns A valid Date object or an Invalid Date if no format matches.
 */
function parseDynamicDate(dateString: string): Date {
    if (!dateString) {
        return new Date(NaN); // Return an invalid date for empty strings
    }

    // List of formats to try, in order of preference.
    // Add any new formats you encounter to this array.
    const SUPPORTED_DATE_FORMATS = [
        // --- Formats with Time (More Specific First) ---
        'M/d/yyyy H:mm:ss',   // "6/7/2025 14:30:15"
        'M/d/yyyy H:mm',      // "6/7/2025 14:30"
        'yyyy-MM-dd HH:mm:ss',// "2025-06-07 14:30:15" (ISO-like)
        'yyyy-MM-dd HH:mm',   // "2025-06-07 14:30"
        'MMMM d, yyyy h:mm a',// "June 7, 2025 2:30 PM" (with AM/PM)

        // --- Date-Only Formats ---
        'MMM d, yyyy',        // "Jun 7, 2025"
        'yyyy-MM-dd',         // "2025-06-07" (ISO Standard - unambiguous)
        'M/d/yyyy',           // "6/7/2025" (Common US)
        'dd/MM/yyyy',         // "07/06/2025" (Common European)
        'dd-MMM-yyyy',        // "07-Jun-2025"
    ];

    for (const formatString of SUPPORTED_DATE_FORMATS) {
        const parsedDate = parse(dateString, formatString, new Date());
        if (isValid(parsedDate)) {
            return parsedDate; // Success! Return the valid date.
        }
    }

    // If the loop finishes, no format matched. Return an invalid date.
    console.warn(`Unrecognized date format: "${dateString}"`);
    return new Date(NaN);
}
// --- MODIFICATION END 1 ---


// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Ensure you have these type definitions if they are not already in a shared functions/types.ts file
type GetFeedbackSummaryData = {
    employeeId: string;
    timeFrame: "daily" | "monthly" | "specific" | "range" | "full";
    date?: string; // ISO string
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
};

type SummaryGraph = {
    totalFeedbacks: number;
    avgUnderstanding: number;
    avgInstructor: number;
};

type TimeseriesGraph = {
    labels: string[];
    understanding: number[]; // Now always numbers, as nulls are skipped
    instructor: number[];    // Now always numbers, as nulls are skipped
};


export const getFeedbackSummary = onCall<GetFeedbackSummaryData>(
    {
        timeoutSeconds: 120,
        memory: "512MiB",
        secrets: ["GEMINI_KEY", "SHEETS_SA_KEY"],
    },
    async (request) => {
        // 1) Authentication and Authorization
        const callerUid = request.auth?.uid;
        const requestedEmployeeId = request.data.employeeId;

        if (!callerUid) {
            throw new HttpsError("unauthenticated", "Authentication required to access feedback data.");
        }

        // --- SECURITY CHECK: Authorize access based on roles/ownership ---
        let isCallerAdmin = false;
        try {
            const userRecord = await admin.auth().getUser(callerUid);
            isCallerAdmin = userRecord.customClaims?.isAdmin === true;
        } catch (error) {
            console.error("Error checking admin status for UID:", callerUid, error);
        }

        if (isCallerAdmin) {
            // Admins are allowed.
        } else {
            const empDocRef = admin.firestore().collection("employees").doc(requestedEmployeeId);
            const empDoc = await empDocRef.get();

            if (!empDoc.exists) {
                throw new HttpsError("not-found", "Employee not found or you don't have access.");
            }

            const employeeData = empDoc.data();
            const employeeUidInDoc = employeeData?.uid;

            if (callerUid !== employeeUidInDoc) {
                console.warn(`Permission denied: User ${callerUid} attempted to access data for employee ${requestedEmployeeId} (UID: ${employeeUidInDoc}).`);
                throw new HttpsError("permission-denied", "You do not have permission to view this employee's data.");
            }
        }
        // --- END SECURITY CHECK ---

        // 2) Load sheet URL and extract spreadsheet ID
        const empDoc = await admin.firestore().collection("employees").doc(requestedEmployeeId).get();
        const sheetUrl = empDoc.data()?.feedbackSheetUrl;
        if (typeof sheetUrl !== "string") {
            throw new HttpsError("not-found", "No feedback sheet URL configured for this employee.");
        }
        const sheetIdMatch = sheetUrl.match(/\/d\/([\w-]+)/);
        if (!sheetIdMatch || !sheetIdMatch[1]) {
            throw new HttpsError("invalid-argument", "Invalid Google Sheet URL format in employee data.");
        }
        const spreadsheetId = sheetIdMatch[1];


        // --- MODIFICATION START: This is the new, robust sheet fetching logic ---
        // 3) Fetch rows from Google Sheet
        const saRaw = process.env.SHEETS_SA_KEY!;
        const sa = JSON.parse(saRaw);
        const jwt = new JWT({
            email: sa.client_email,
            key: sa.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth: jwt });

        // Step 3a: Get the GID from the URL. If not present, default to 0 (the first sheet).
        const gidMatch = sheetUrl.match(/[#&]gid=(\d+)/);
        const targetGid = gidMatch ? parseInt(gidMatch[1], 10) : 0;

        // Step 3b: Fetch metadata for the entire spreadsheet
        const spreadsheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });

        // Step 3c: Find the specific sheet's properties using the targetGid
        const targetSheet = spreadsheetMetadata.data.sheets?.find(
            (s) => s.properties?.sheetId === targetGid
        );

        if (!targetSheet?.properties?.title) {
            throw new HttpsError("not-found", `Sheet with ID (gid) "${targetGid}" could not be found in the spreadsheet.`);
        }

        // Step 3d: Construct the range dynamically with the sheet's actual current name
        const sheetName = targetSheet.properties.title;
        const range = `${sheetName}!A:D`;

        // Step 3e: Fetch the data using the dynamically found range
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range, // Use the robust, dynamic range instead of a hardcoded one
        });
        // --- MODIFICATION END ---


        const rows = resp.data.values;
        if (!rows || rows.length < 2) {
            return {
                positiveFeedback: [],
                improvementAreas: [],
                totalFeedbacks: 0,
                graphData: null,
                graphTimeseries: null
            };
        }

        // 4) Parse into objects
        const dataRows = rows.slice(1).map(r => ({
            date: parseDynamicDate(r[0]?.toString() || ""),
            understanding: Number(r[1]) || 0,
            instructor: Number(r[2]) || 0,
            comment: (r[3] || "").toString().trim(),
        })).filter(x => !isNaN(x.date.getTime()));

        // 5) Apply filter
        const today0 = startOfDay(new Date());
        let filtered = dataRows;
        if (request.data.timeFrame === "daily") {
            filtered = dataRows.filter(x => isSameDay(x.date, today0));
        }
        else if (request.data.timeFrame === "specific" && request.data.date) {
            const tgt = startOfDay(parseISO(request.data.date));
            filtered = dataRows.filter(x => isSameDay(x.date, tgt));
        }
        else if (request.data.timeFrame === "monthly") {
            const ref = request.data.date ? parseISO(request.data.date) : today0;
            filtered = dataRows.filter(x => isSameMonth(x.date, ref));
        }
        else if (request.data.timeFrame === "range" && request.data.startDate && request.data.endDate) {
            const s0 = startOfDay(parseISO(request.data.startDate));
            const e0 = endOfDay(parseISO(request.data.endDate));
            filtered = dataRows.filter(x => x.date >= s0 && x.date <= e0);
        }
        // "full" timeFrame means no filtering applied here.

        const totalFeedbacks = filtered.length;
        if (!totalFeedbacks) {
            return {
                positiveFeedback: [],
                improvementAreas: [],
                totalFeedbacks: 0,
                graphData: null,
                graphTimeseries: null
            };
        }

        // 6) Build summary graphData
        let graphData: SummaryGraph | null = null;
        if (["daily", "specific", "monthly"].includes(request.data.timeFrame)) {
            const sumU = filtered.reduce((s, r) => s + r.understanding, 0);
            const sumI = filtered.reduce((s, r) => s + r.instructor, 0);
            graphData = {
                totalFeedbacks,
                avgUnderstanding: parseFloat((sumU / totalFeedbacks).toFixed(2)),
                avgInstructor: parseFloat((sumI / totalFeedbacks).toFixed(2)),
            };
        }

        // 7) Build timeseries for full/range
        let graphTimeseries: TimeseriesGraph | null = null;

        if (request.data.timeFrame === "range") {
            const dailyAggregates = new Map<string, { sumU: number; sumI: number; count: number }>();
            filtered.forEach(row => {
                const dayKey = format(row.date, 'yyyy-MM-dd');
                if (!dailyAggregates.has(dayKey)) {
                    dailyAggregates.set(dayKey, { sumU: 0, sumI: 0, count: 0 });
                }
                const dayStats = dailyAggregates.get(dayKey)!;
                dayStats.sumU += row.understanding;
                dayStats.sumI += row.instructor;
                dayStats.count += 1;
            });

            const sortedDayKeys = Array.from(dailyAggregates.keys()).sort();

            const labels: string[] = [];
            const understandingValues: number[] = [];
            const instructorValues: number[] = [];

            for (const dayKey of sortedDayKeys) {
                const dayStats = dailyAggregates.get(dayKey)!;
                labels.push(format(parseISO(dayKey), 'MMM d'));
                understandingValues.push(parseFloat((dayStats.sumU / dayStats.count).toFixed(1)));
                instructorValues.push(parseFloat((dayStats.sumI / dayStats.count).toFixed(1)));
            }
            graphTimeseries = { labels: labels, understanding: understandingValues, instructor: instructorValues };

            // Find this part of your function...
        } else if (request.data.timeFrame === "full") {
            // --- MODIFICATION START ---

            // The Map key is now a string (e.g., "2025-06") instead of a number.
            const monthlyAggregates = new Map<string, { sumU: number; sumI: number; count: number }>();

            filtered.forEach(row => {
                // The key now includes the YEAR and the MONTH for correct chronological sorting.
                const monthKey = format(row.date, 'yyyy-MM');

                if (!monthlyAggregates.has(monthKey)) {
                    monthlyAggregates.set(monthKey, { sumU: 0, sumI: 0, count: 0 });
                }
                const monthStats = monthlyAggregates.get(monthKey)!;
                monthStats.sumU += row.understanding;
                monthStats.sumI += row.instructor;
                monthStats.count += 1;
            });

            // A simple string sort is now chronologically correct (e.g., "2024-12" comes before "2025-01").
            const sortedMonthKeys = Array.from(monthlyAggregates.keys()).sort();

            const labels: string[] = [];
            const understandingValues: number[] = [];
            const instructorValues: number[] = [];

            for (const monthKey of sortedMonthKeys) {
                const monthStats = monthlyAggregates.get(monthKey)!;

                // We parse the key back to a date to format it nicely for the chart label.
                // This will produce labels like "Dec 2024", "Jan 2025", etc.
                const labelDate = parse(monthKey, 'yyyy-MM', new Date());
                labels.push(format(labelDate, "MMM yyyy"));

                understandingValues.push(parseFloat((monthStats.sumU / monthStats.count).toFixed(2)));
                instructorValues.push(parseFloat((monthStats.sumI / monthStats.count).toFixed(2)));
            }
            graphTimeseries = { labels: labels, understanding: understandingValues, instructor: instructorValues };

            // --- MODIFICATION END ---
        } else {
            graphTimeseries = null;
        }

        // 8) AI summary
        const skip = ["na", "n/a", "none", "ntg", "nil", ""];
        const comments = filtered.map(x => x.comment)
            .filter(t => t && !skip.includes(t.toLowerCase()));
        let positiveFeedback: any[] = [];
        let improvementAreas: any[] = [];
        if (comments.length) {
            const model = new GoogleGenerativeAI(getGeminiKey())
                .getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `From the following list of verbatim feedback comments, perform an analysis. Return a valid JSON object with two keys: "positiveFeedback" and "improvementAreas". For "positiveFeedback", return an array of up to 3 objects, where each object has a "quote" key (the verbatim positive comment) and a "keywords" key (an array of 1-3 relevant keywords from the quote). For "improvementAreas", return an array of up to 3 objects, where each object has a "theme" key (a summarized topic like 'Pacing' or 'Interaction') and a "suggestion" key (a concise, actionable suggestion for the instructor). If there are no comments that fit a category, return an empty array for that key. Comments: """${comments.join("\n")}"""`;
            const aiRes = await model.generateContent(prompt);
            const aiTxt = aiRes.response.text();
            try {
                const js = aiTxt.slice(aiTxt.indexOf("{"), aiTxt.lastIndexOf("}") + 1);
                const obj = JSON.parse(js);
                positiveFeedback = obj.positiveFeedback || [];
                improvementAreas = obj.improvementAreas || [];
            } catch (e) {
                console.error("AI parse error", e, aiTxt);
            }
        }

        // 9) Return everything
        return {
            positiveFeedback,
            improvementAreas,
            totalFeedbacks,
            graphData,
            graphTimeseries,
        };
    }
);