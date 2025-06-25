import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Import the Badge component
import { Loader2, TrendingUp, Sparkles, Lightbulb, MessageSquare, Quote } from "lucide-react";

import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// --- NEW, RICHER TYPE DEFINITIONS ---
type GraphData = {
    totalFeedbacks: number;
    avgUnderstanding: number;
    avgInstructor: number;
};

type PositiveFeedback = {
    quote: string;
    keywords: string[];
};

type ImprovementArea = {
    theme: string;
    suggestion: string;
};

type FeedbackSummary = {
    positiveFeedback: PositiveFeedback[];
    improvementAreas: ImprovementArea[];
    graphData: GraphData | null;
};


export default function AdminEmployeeDetail() {
    const { employeeId } = useParams<{ employeeId: string }>();
    const navigate = useNavigate();

    const [summary, setSummary] = useState<FeedbackSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeFrame, setTimeFrame] = useState<"monthly" | "daily">("monthly");

    useEffect(() => {
        if (!employeeId) return;

        const fetchSummary = async () => {
            setLoading(true);
            setError(null);
            try {
                const functions = getFunctions();
                const getFeedbackSummary = httpsCallable(functions, 'getFeedbackSummary');
                const result = await getFeedbackSummary({ employeeId, timeFrame });
                setSummary(result.data as FeedbackSummary);
            } catch (err: unknown) {
                console.error("Error fetching feedback summary:", err);
                const errorMessage = err instanceof Error ? err.message : "Failed to load feedback data.";
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [employeeId, timeFrame]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Average Ratings (${timeFrame})`, font: { size: 16 } },
        },
        scales: { y: { beginAtZero: true, min: 0, max: 5, title: { display: true, text: 'Rating (out of 5)' } } }
    };

    const chartData = {
        labels: ['Understanding', 'Instructor'],
        datasets: [
            {
                label: 'Average Rating',
                data: [
                    summary?.graphData?.avgUnderstanding || 0,
                    summary?.graphData?.avgInstructor || 0,
                ],
                backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)'],
                borderWidth: 1,
            },
        ],
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">Analyzing feedback data...</p>
                </div>
            );
        }

        if (error) {
            return <div className="text-center text-red-500 py-10">{error}</div>;
        }

        if (!summary || (!summary.positiveFeedback && !summary.improvementAreas && !summary.graphData)) {
            return <div className="text-center text-muted-foreground py-10">No feedback data found for this period.</div>;
        }

        // --- NEW, UPGRADED UI RENDER ---
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquare className="text-blue-500" /> Quantitative Feedback</CardTitle>
                            <CardDescription>Total Feedbacks Given: {summary.graphData?.totalFeedbacks || 0}</CardDescription>
                        </CardHeader>
                        <CardContent style={{ height: '300px' }}>
                            {summary.graphData ? <Bar options={chartOptions} data={chartData} /> : <p>No rating data available.</p>}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="text-yellow-500" /> AI Summary: Positive Feedback</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.positiveFeedback?.length > 0 ? (
                            summary.positiveFeedback.map((fb, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                    <p className="italic text-gray-700 flex gap-2"><Quote className="h-4 w-4 text-gray-300" /> {fb.quote}</p>
                                    <div className="mt-2">
                                        {fb.keywords?.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                    </div>
                                </div>
                            ))
                        ) : <p className="text-muted-foreground text-sm">No positive comments found for this period.</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lightbulb className="text-green-500" /> AI Summary: Areas for Improvement</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.improvementAreas?.length > 0 ? (
                            summary.improvementAreas.map((item, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                    <p className="font-semibold text-gray-800">{item.theme}</p>
                                    <p className="text-sm text-gray-600">{item.suggestion}</p>
                                </div>
                            ))
                        ) : <p className="text-muted-foreground text-sm">No specific improvement areas found.</p>}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <AppNavbar />
            <main className="flex-1 flex flex-col items-center py-10 px-4">
                <div className="w-full max-w-6xl">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold">Feedback Dashboard</h1>
                            <p className="text-muted-foreground">Viewing data for employee ID: {employeeId}</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate("/admin/employees")}>Back to All Employees</Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Button onClick={() => setTimeFrame("daily")} variant={timeFrame === 'daily' ? 'default' : 'outline'}>Today</Button>
                        <Button onClick={() => setTimeFrame("monthly")} variant={timeFrame === 'monthly' ? 'default' : 'outline'}>This Month</Button>
                    </div>

                    {renderContent()}
                </div>
            </main>
        </div>
    );
}