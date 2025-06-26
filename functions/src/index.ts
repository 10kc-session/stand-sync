import * as admin from "firebase-admin";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
    parse,
    isSameDay,
    isSameMonth,
    startOfDay,
    endOfDay,
    parseISO,
    format,
} from "date-fns";

admin.initializeApp();

function getGeminiKey(): string {
    const key = process.env.GEMINI_KEY;
    if (!key) throw new Error("GEMINI_KEY not set.");
    return key;
}

interface GetFeedbackSummaryData {
    employeeId: string;
    timeFrame: "daily" | "monthly" | "specific" | "range" | "full";
    date?: string;
    startDate?: string;
    endDate?: string;
}

interface SummaryGraph {
    totalFeedbacks: number;
    avgUnderstanding: number;
    avgInstructor: number;
}

interface TimeseriesGraph {
    labels: string[];
    understanding: number[];
    instructor: number[];
}
export const getFeedbackSummary = onCall<GetFeedbackSummaryData>(
    {
        timeoutSeconds: 120,
        memory: "512MiB",
        secrets: ["GEMINI_KEY", "SHEETS_SA_KEY"],
    },
    async (request) => {
        if (request.auth?.token.isAdmin !== true) {
            throw new HttpsError("permission-denied", "Admins only.");
        }
        const { employeeId, timeFrame, date, startDate, endDate } = request.data;
        if (!employeeId) {
            throw new HttpsError("invalid-argument", "Missing employeeId.");
        }

        // 2) Load sheet URL
        const empDoc = await admin.firestore().collection("employees").doc(employeeId).get();
        if (!empDoc.exists) {
            throw new HttpsError("not-found", "Employee not found.");
        }
        const sheetUrl = empDoc.data()?.feedback_sheet_url;
        if (typeof sheetUrl !== "string") {
            throw new HttpsError("not-found", "No feedback sheet URL.");
        }
        const m = sheetUrl.match(/\/d\/([\w-]+)/);
        if (!m) throw new HttpsError("invalid-argument", "Invalid Sheet URL.");
        const spreadsheetId = m[1];

        // 3) Fetch rows
        const saRaw = process.env.SHEETS_SA_KEY!;
        const sa = JSON.parse(saRaw);
        const jwt = new JWT({
            email: sa.client_email,
            key: sa.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = google.sheets({ version: "v4", auth: jwt });
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId, range: "Sheet1!A:D"
        });
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
            date: parse(r[0]?.toString() || "", "M/d/yyyy H:mm:ss", new Date()),
            understanding: Number(r[1]) || 0,
            instructor: Number(r[2]) || 0,
            comment: (r[3] || "").toString().trim(),
        })).filter(x => !isNaN(x.date.getTime()));

        // 5) Apply filter
        const today0 = startOfDay(new Date());
        let filtered = dataRows;
        if (timeFrame === "daily") {
            filtered = dataRows.filter(x => isSameDay(x.date, today0));
        }
        else if (timeFrame === "specific" && date) {
            const tgt = startOfDay(parseISO(date));
            filtered = dataRows.filter(x => isSameDay(x.date, tgt));
        }
        else if (timeFrame === "monthly") {
            const ref = date ? parseISO(date) : today0;
            filtered = dataRows.filter(x => isSameMonth(x.date, ref));
        }
        else if (timeFrame === "range" && startDate && endDate) {
            const s0 = startOfDay(parseISO(startDate));
            const e0 = endOfDay(parseISO(endDate));    // fully inclusive
            filtered = dataRows.filter(x => x.date >= s0 && x.date <= e0);
        }
        // "full" leaves `filtered` === all rows

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
        if (["daily", "specific", "monthly"].includes(timeFrame)) {
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

        // **MODIFIED LOGIC**: For a date range, group data by day and only include days that have feedback.
        if (timeFrame === "range" && startDate && endDate) {
            // Use a Map to group feedback entries by day.
            // Key: 'yyyy-MM-dd' string, Value: { sumU, sumI, count }
            const dailyData = new Map<string, { sumU: number; sumI: number; count: number }>();

            // 1. Iterate over the filtered data and group it by day.
            for (const row of filtered) {
                const dayKey = format(row.date, 'yyyy-MM-dd'); // e.g., "2025-06-05"

                if (!dailyData.has(dayKey)) {
                    dailyData.set(dayKey, { sumU: 0, sumI: 0, count: 0 });
                }

                const dayStats = dailyData.get(dayKey)!;
                dayStats.sumU += row.understanding;
                dayStats.sumI += row.instructor;
                dayStats.count += 1;
            }

            // 2. Sort the days chronologically.
            const sortedDays = Array.from(dailyData.keys()).sort();

            // 3. Build the final arrays for the chart using only the sorted, existing data.
            const labels: string[] = [];
            const understanding: number[] = [];
            const instructor: number[] = [];

            for (const dayKey of sortedDays) {
                const dayStats = dailyData.get(dayKey)!;

                labels.push(format(parseISO(dayKey), 'MMM d')); // Format label as "Jun 5"

                const avgU = dayStats.sumU / dayStats.count;
                const avgI = dayStats.sumI / dayStats.count;

                understanding.push(parseFloat(avgU.toFixed(2)));
                instructor.push(parseFloat(avgI.toFixed(2)));
            }

            graphTimeseries = { labels, understanding, instructor };

        } else if (timeFrame === "full") {
            // Logic for "full" history remains the same, showing a 12-month overview.
            const labels: string[] = [];
            const understanding: number[] = [];
            const instructor: number[] = [];
            for (let m = 0; m < 12; m++) {
                labels.push(format(new Date(0, m), "MMM"));
                // This uses all data rows to build the yearly summary
                const monthRows = dataRows.filter(x => x.date.getMonth() === m);
                if (monthRows.length) {
                    const u = monthRows.reduce((s, r) => s + r.understanding, 0) / monthRows.length;
                    const i = monthRows.reduce((s, r) => s + r.instructor, 0) / monthRows.length;
                    understanding.push(parseFloat(u.toFixed(2)));
                    instructor.push(parseFloat(i.toFixed(2)));
                } else {
                    understanding.push(0);
                    instructor.push(0);
                }
            }
            graphTimeseries = { labels, understanding, instructor };
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
            const aiTxt = await aiRes.response.text();
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
