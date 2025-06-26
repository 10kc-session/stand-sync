import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
    Calendar as CalendarIcon,
    Loader2,
    Sparkles,
    MessageSquare,
    Quote,
    Lightbulb,
} from "lucide-react";
import { format } from "date-fns";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Helper: Snap to local midnight, then add 1 day,
 * so that after ISO→UTC conversion it still lands on your picked day.
 */
function toLocalMidnightPlusOneISOString(date: Date): string {
    // Build a Date at local midnight of the picked day
    const localMid = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Add one full day
    localMid.setDate(localMid.getDate() + 1);
    // Convert that instant to ISO (UTC)
    return localMid.toISOString();
}

type GraphData = {
    totalFeedbacks: number;
    avgUnderstanding: number;
    avgInstructor: number;
};

type PositiveFeedback = { quote: string; keywords: string[] };
type ImprovementArea = { theme: string; suggestion: string };

type FeedbackSummary = {
    positiveFeedback: PositiveFeedback[];
    improvementAreas: ImprovementArea[];
    graphData: GraphData | null;
};

type FilterType = {
    mode: "daily" | "monthly" | "specific";
    date?: Date;
};

export default function AdminEmployeeDetail() {
    const { employeeId } = useParams<{ employeeId: string }>();
    const navigate = useNavigate();

    const [summary, setSummary] = useState<FeedbackSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>({ mode: "monthly" });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    useEffect(() => {
        if (!employeeId) return;

        async function fetchSummary() {
            setLoading(true);
            setError(null);
            try {
                const functions = getFunctions();
                const getFeedbackSummary = httpsCallable(functions, "getFeedbackSummary");

                const params = {
                    employeeId,
                    timeFrame: filter.mode,
                    // use our new helper here
                    date: filter.date
                        ? toLocalMidnightPlusOneISOString(filter.date)
                        : undefined,
                };

                const result = await getFeedbackSummary(params);
                setSummary(result.data as FeedbackSummary);
            } catch (err: any) {
                console.error("Error fetching feedback summary:", err);
                setError(err.message || "Failed to load feedback data.");
            } finally {
                setLoading(false);
            }
        }

        fetchSummary();
    }, [employeeId, filter]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: `Average Ratings (${filter.mode})`,
                font: { size: 16 },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                min: 0,
                max: 5,
                title: { display: true, text: "Rating (out of 5)" },
            },
        },
    };

    const chartData = {
        labels: ["Understanding", "Instructor"],
        datasets: [
            {
                label: "Average Rating",
                data: [
                    summary?.graphData?.avgUnderstanding || 0,
                    summary?.graphData?.avgInstructor || 0,
                ],
                backgroundColor: ["rgba(54,162,235,0.6)", "rgba(75,192,192,0.6)"],
                borderColor: ["rgba(54,162,235,1)", "rgba(75,192,192,1)"],
                borderWidth: 1,
            },
        ],
    };

    function renderContent() {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">
                        Analyzing feedback data...
                    </p>
                </div>
            );
        }
        if (error) {
            return <div className="text-center text-red-500 py-10">{error}</div>;
        }
        if (!summary || !summary.graphData) {
            return (
                <div className="text-center text-muted-foreground py-10">
                    No feedback data found for this period.
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="text-blue-500" /> Quantitative
                                Feedback
                            </CardTitle>
                            <CardDescription>
                                Total Feedbacks Given: {summary.graphData.totalFeedbacks}
                            </CardDescription>
                        </CardHeader>
                        <CardContent style={{ height: 300 }}>
                            <Bar options={chartOptions} data={chartData} />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="text-yellow-500" /> AI Summary: Positive
                            Feedback
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.positiveFeedback.length > 0 ? (
                            summary.positiveFeedback.map((fb, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                                    <p className="italic text-gray-700 flex gap-2">
                                        <Quote className="h-4 w-4 text-gray-300" /> {fb.quote}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {fb.keywords.map((kw) => (
                                            <Badge key={kw} variant="secondary">
                                                {kw}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No positive comments found for this period.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="text-green-500" /> AI Summary: Areas for
                            Improvement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.improvementAreas.length > 0 ? (
                            summary.improvementAreas.map((item, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                                    <p className="font-semibold text-gray-800">{item.theme}</p>
                                    <p className="text-sm text-gray-600">{item.suggestion}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No specific improvement areas found.
                            </p>
                        )}
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
                            <p className="text-muted-foreground">
                                Viewing data for employee ID: {employeeId}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => navigate("/admin/employees")}
                        >
                            Back to All Employees
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Button
                            onClick={() => setFilter({ mode: "daily" })}
                            variant={filter.mode === "daily" ? "default" : "outline"}
                        >
                            Today
                        </Button>
                        <Button
                            onClick={() => setFilter({ mode: "monthly" })}
                            variant={filter.mode === "monthly" ? "default" : "outline"}
                        >
                            This Month
                        </Button>
                        <Popover
                            open={isDatePickerOpen}
                            onOpenChange={setIsDatePickerOpen}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-[280px] justify-start text-left font-normal",
                                        !filter.date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {filter.date && filter.mode === "specific" ? (
                                        format(filter.date, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={filter.date}
                                    onSelect={(date) => {
                                        setFilter({ mode: "specific", date: date as Date });
                                        setIsDatePickerOpen(false);
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
