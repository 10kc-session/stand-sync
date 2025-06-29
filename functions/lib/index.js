"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeedbackSummary = exports.deleteEmployee = exports.addAdminRole = void 0;
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const googleapis_1 = require("googleapis");
const generative_ai_1 = require("@google/generative-ai");
const https_1 = require("firebase-functions/v2/https");
const date_fns_1 = require("date-fns");
admin.initializeApp();
function getGeminiKey() {
    const key = process.env.GEMINI_KEY;
    if (!key)
        throw new Error("GEMINI_KEY not set.");
    return key;
}
exports.addAdminRole = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required.");
    const caller = request.auth.token;
    if (!caller.isAdmin)
        throw new https_1.HttpsError("permission-denied", "Admins only.");
    const email = (_a = request.data.email) === null || _a === void 0 ? void 0 : _a.trim();
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Provide a valid email.");
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
        return { message: `${email} is now an admin.` };
    }
    catch (err) {
        if (err.code === "auth/user-not-found") {
            throw new https_1.HttpsError("not-found", "User not found.");
        }
        console.error("addAdminRole error:", err);
        throw new https_1.HttpsError("internal", "Could not set admin role.");
    }
});
// Delete an employee's account and Firestore document
exports.deleteEmployee = (0, https_1.onCall)(async (request) => {
    // 1) Must be called by an authenticated user
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    // 2) Must be an admin (custom claim)
    const isAdmin = request.auth.token.isAdmin;
    if (!isAdmin) {
        throw new https_1.HttpsError("permission-denied", "Only admins can delete employees.");
    }
    // 3) Validate input
    const uid = request.data.uid;
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid `uid` parameter.");
    }
    try {
        // 4) Delete the Auth user
        await admin.auth().deleteUser(uid);
        // 5) Delete the Firestore document
        await admin.firestore().doc(`employees/${uid}`).delete();
        return { message: "User account and profile deleted." };
    }
    catch (error) {
        console.error("deleteEmployee error:", error);
        // wrap any thrown error as HttpsError
        throw new https_1.HttpsError("internal", error.message || "An unknown error occurred.");
    }
});
// --- MODIFICATION START 1: The new flexible date parsing function ---
/**
 * Tries to parse a date string using a list of supported formats.
 * @param dateString The raw date string from the Google Sheet.
 * @returns A valid Date object or an Invalid Date if no format matches.
 */
function parseDynamicDate(dateString) {
    if (!dateString) {
        return new Date(NaN); // Return an invalid date for empty strings
    }
    // List of formats to try, in order of preference.
    // Add any new formats you encounter to this array.
    const SUPPORTED_DATE_FORMATS = [
        // --- Formats with Time (More Specific First) ---
        'M/d/yyyy H:mm:ss', // "6/7/2025 14:30:15"
        'M/d/yyyy H:mm', // "6/7/2025 14:30"
        'yyyy-MM-dd HH:mm:ss', // "2025-06-07 14:30:15" (ISO-like)
        'yyyy-MM-dd HH:mm', // "2025-06-07 14:30"
        'MMMM d, yyyy h:mm a', // "June 7, 2025 2:30 PM" (with AM/PM)
        // --- Date-Only Formats ---
        'MMM d, yyyy', // "Jun 7, 2025"
        'yyyy-MM-dd', // "2025-06-07" (ISO Standard - unambiguous)
        'M/d/yyyy', // "6/7/2025" (Common US)
        'dd/MM/yyyy', // "07/06/2025" (Common European)
        'dd-MMM-yyyy', // "07-Jun-2025"
    ];
    for (const formatString of SUPPORTED_DATE_FORMATS) {
        const parsedDate = (0, date_fns_1.parse)(dateString, formatString, new Date());
        if ((0, date_fns_1.isValid)(parsedDate)) {
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
exports.getFeedbackSummary = (0, https_1.onCall)({
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: ["GEMINI_KEY", "SHEETS_SA_KEY"],
}, async (request) => {
    var _a, _b, _c, _d, _e;
    // 1) Authentication and Authorization
    const callerUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    const requestedEmployeeId = request.data.employeeId;
    if (!callerUid) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required to access feedback data.");
    }
    // --- SECURITY CHECK: Authorize access based on roles/ownership ---
    let isCallerAdmin = false;
    try {
        const userRecord = await admin.auth().getUser(callerUid);
        isCallerAdmin = ((_b = userRecord.customClaims) === null || _b === void 0 ? void 0 : _b.isAdmin) === true;
    }
    catch (error) {
        console.error("Error checking admin status for UID:", callerUid, error);
    }
    if (isCallerAdmin) {
        // Admins are allowed.
    }
    else {
        const empDocRef = admin.firestore().collection("employees").doc(requestedEmployeeId);
        const empDoc = await empDocRef.get();
        if (!empDoc.exists) {
            throw new https_1.HttpsError("not-found", "Employee not found or you don't have access.");
        }
        const employeeData = empDoc.data();
        const employeeUidInDoc = employeeData === null || employeeData === void 0 ? void 0 : employeeData.uid;
        if (callerUid !== employeeUidInDoc) {
            console.warn(`Permission denied: User ${callerUid} attempted to access data for employee ${requestedEmployeeId} (UID: ${employeeUidInDoc}).`);
            throw new https_1.HttpsError("permission-denied", "You do not have permission to view this employee's data.");
        }
    }
    // --- END SECURITY CHECK ---
    // 2) Load sheet URL and extract spreadsheet ID
    const empDoc = await admin.firestore().collection("employees").doc(requestedEmployeeId).get();
    const sheetUrl = (_c = empDoc.data()) === null || _c === void 0 ? void 0 : _c.feedbackSheetUrl;
    if (typeof sheetUrl !== "string") {
        throw new https_1.HttpsError("not-found", "No feedback sheet URL configured for this employee.");
    }
    const sheetIdMatch = sheetUrl.match(/\/d\/([\w-]+)/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
        throw new https_1.HttpsError("invalid-argument", "Invalid Google Sheet URL format in employee data.");
    }
    const spreadsheetId = sheetIdMatch[1];
    // --- MODIFICATION START: This is the new, robust sheet fetching logic ---
    // 3) Fetch rows from Google Sheet
    const saRaw = process.env.SHEETS_SA_KEY;
    const sa = JSON.parse(saRaw);
    const jwt = new google_auth_library_1.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = googleapis_1.google.sheets({ version: "v4", auth: jwt });
    // Step 3a: Get the GID from the URL. If not present, default to 0 (the first sheet).
    const gidMatch = sheetUrl.match(/[#&]gid=(\d+)/);
    const targetGid = gidMatch ? parseInt(gidMatch[1], 10) : 0;
    // Step 3b: Fetch metadata for the entire spreadsheet
    const spreadsheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
    // Step 3c: Find the specific sheet's properties using the targetGid
    const targetSheet = (_d = spreadsheetMetadata.data.sheets) === null || _d === void 0 ? void 0 : _d.find((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.sheetId) === targetGid; });
    if (!((_e = targetSheet === null || targetSheet === void 0 ? void 0 : targetSheet.properties) === null || _e === void 0 ? void 0 : _e.title)) {
        throw new https_1.HttpsError("not-found", `Sheet with ID (gid) "${targetGid}" could not be found in the spreadsheet.`);
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
    const dataRows = rows.slice(1).map(r => {
        var _a;
        return ({
            date: parseDynamicDate(((_a = r[0]) === null || _a === void 0 ? void 0 : _a.toString()) || ""),
            understanding: Number(r[1]) || 0,
            instructor: Number(r[2]) || 0,
            comment: (r[3] || "").toString().trim(),
        });
    }).filter(x => !isNaN(x.date.getTime()));
    // 5) Apply filter
    const today0 = (0, date_fns_1.startOfDay)(new Date());
    let filtered = dataRows;
    if (request.data.timeFrame === "daily") {
        filtered = dataRows.filter(x => (0, date_fns_1.isSameDay)(x.date, today0));
    }
    else if (request.data.timeFrame === "specific" && request.data.date) {
        const tgt = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(request.data.date));
        filtered = dataRows.filter(x => (0, date_fns_1.isSameDay)(x.date, tgt));
    }
    else if (request.data.timeFrame === "monthly") {
        const ref = request.data.date ? (0, date_fns_1.parseISO)(request.data.date) : today0;
        filtered = dataRows.filter(x => (0, date_fns_1.isSameMonth)(x.date, ref));
    }
    else if (request.data.timeFrame === "range" && request.data.startDate && request.data.endDate) {
        const s0 = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(request.data.startDate));
        const e0 = (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(request.data.endDate));
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
    let graphData = null;
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
    let graphTimeseries = null;
    if (request.data.timeFrame === "range") {
        const dailyAggregates = new Map();
        filtered.forEach(row => {
            const dayKey = (0, date_fns_1.format)(row.date, 'yyyy-MM-dd');
            if (!dailyAggregates.has(dayKey)) {
                dailyAggregates.set(dayKey, { sumU: 0, sumI: 0, count: 0 });
            }
            const dayStats = dailyAggregates.get(dayKey);
            dayStats.sumU += row.understanding;
            dayStats.sumI += row.instructor;
            dayStats.count += 1;
        });
        const sortedDayKeys = Array.from(dailyAggregates.keys()).sort();
        const labels = [];
        const understandingValues = [];
        const instructorValues = [];
        for (const dayKey of sortedDayKeys) {
            const dayStats = dailyAggregates.get(dayKey);
            labels.push((0, date_fns_1.format)((0, date_fns_1.parseISO)(dayKey), 'MMM d'));
            understandingValues.push(parseFloat((dayStats.sumU / dayStats.count).toFixed(1)));
            instructorValues.push(parseFloat((dayStats.sumI / dayStats.count).toFixed(1)));
        }
        graphTimeseries = { labels: labels, understanding: understandingValues, instructor: instructorValues };
        // Find this part of your function...
    }
    else if (request.data.timeFrame === "full") {
        // --- MODIFICATION START ---
        // The Map key is now a string (e.g., "2025-06") instead of a number.
        const monthlyAggregates = new Map();
        filtered.forEach(row => {
            // The key now includes the YEAR and the MONTH for correct chronological sorting.
            const monthKey = (0, date_fns_1.format)(row.date, 'yyyy-MM');
            if (!monthlyAggregates.has(monthKey)) {
                monthlyAggregates.set(monthKey, { sumU: 0, sumI: 0, count: 0 });
            }
            const monthStats = monthlyAggregates.get(monthKey);
            monthStats.sumU += row.understanding;
            monthStats.sumI += row.instructor;
            monthStats.count += 1;
        });
        // A simple string sort is now chronologically correct (e.g., "2024-12" comes before "2025-01").
        const sortedMonthKeys = Array.from(monthlyAggregates.keys()).sort();
        const labels = [];
        const understandingValues = [];
        const instructorValues = [];
        for (const monthKey of sortedMonthKeys) {
            const monthStats = monthlyAggregates.get(monthKey);
            // We parse the key back to a date to format it nicely for the chart label.
            // This will produce labels like "Dec 2024", "Jan 2025", etc.
            const labelDate = (0, date_fns_1.parse)(monthKey, 'yyyy-MM', new Date());
            labels.push((0, date_fns_1.format)(labelDate, "MMM yyyy"));
            understandingValues.push(parseFloat((monthStats.sumU / monthStats.count).toFixed(2)));
            instructorValues.push(parseFloat((monthStats.sumI / monthStats.count).toFixed(2)));
        }
        graphTimeseries = { labels: labels, understanding: understandingValues, instructor: instructorValues };
        // --- MODIFICATION END ---
    }
    else {
        graphTimeseries = null;
    }
    // 8) AI summary
    const skip = ["na", "n/a", "none", "ntg", "nil", ""];
    const comments = filtered.map(x => x.comment)
        .filter(t => t && !skip.includes(t.toLowerCase()));
    let positiveFeedback = [];
    let improvementAreas = [];
    if (comments.length) {
        const model = new generative_ai_1.GoogleGenerativeAI(getGeminiKey())
            .getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `From the following list of verbatim feedback comments, perform an analysis. Return a valid JSON object with two keys: "positiveFeedback" and "improvementAreas". For "positiveFeedback", return an array of up to 3 objects, where each object has a "quote" key (the verbatim positive comment) and a "keywords" key (an array of 1-3 relevant keywords from the quote). For "improvementAreas", return an array of up to 3 objects, where each object has a "theme" key (a summarized topic like 'Pacing' or 'Interaction') and a "suggestion" key (a concise, actionable suggestion for the instructor). If there are no comments that fit a category, return an empty array for that key. Comments: """${comments.join("\n")}"""`;
        const aiRes = await model.generateContent(prompt);
        const aiTxt = aiRes.response.text();
        try {
            const js = aiTxt.slice(aiTxt.indexOf("{"), aiTxt.lastIndexOf("}") + 1);
            const obj = JSON.parse(js);
            positiveFeedback = obj.positiveFeedback || [];
            improvementAreas = obj.improvementAreas || [];
        }
        catch (e) {
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
});
//# sourceMappingURL=index.js.map