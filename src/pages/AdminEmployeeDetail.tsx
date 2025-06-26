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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Calendar as CalendarIcon,
    Loader2,
    Sparkles,
    MessageSquare,
    Quote,
    Lightbulb,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register all necessary Chart.js components including the datalabels plugin
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);


// --- Type Definitions for data from the backend ---
type SummaryGraphData = {
    totalFeedbacks: number;
    avgUnderstanding: number;
    avgInstructor: number;
};
type TimeseriesGraphData = {
    labels: string[];
    understanding: (number | null)[];
    instructor: (number | null)[];
};
type PositiveFeedback = { quote: string; keywords: string[] };
type ImprovementArea = { theme: string; suggestion: string };

type FeedbackSummary = {
    totalFeedbacks: number;
    positiveFeedback: PositiveFeedback[];
    improvementAreas: ImprovementArea[];
    graphData: SummaryGraphData | null;
    graphTimeseries: TimeseriesGraphData | null;
};

// --- State type for the *active* filter that triggers the API call ---
type ActiveFilter = {
    mode: "daily" | "monthly" | "specific" | "range" | "full";
    date?: Date;
    dateRange?: DateRange;
};

export default function AdminEmployeeDetail() {
    const { employeeId } = useParams<{ employeeId: string }>();
    const navigate = useNavigate();

    // Final data from the API call
    const [summary, setSummary] = useState<FeedbackSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Default filter is now "daily"
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ mode: "daily", date: new Date() });

    // --- Temporary state for the UI controls before "Apply" is clicked ---
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);

    // Main data fetching effect
    useEffect(() => {
        if (!employeeId) return;

        const fetchSummary = async () => {
            setLoading(true);
            setError(null);
            try {
                const functions = getFunctions();
                const getFeedbackSummary = httpsCallable(functions, "getFeedbackSummary");

                const params: any = {
                    employeeId,
                    timeFrame: activeFilter.mode,
                };

                // **THIS SECTION IS CORRECTED**
                if (activeFilter.mode === 'monthly' && activeFilter.date) {
                    // When sending a monthly filter, we must construct a date that represents
                    // the first day of that month in the UTC timezone to prevent shifting.
                    params.date = new Date(Date.UTC(activeFilter.date.getFullYear(), activeFilter.date.getMonth(), 1)).toISOString();
                } else if (activeFilter.mode === 'daily' || activeFilter.mode === 'specific') {
                    params.date = activeFilter.date?.toISOString();
                } else if (activeFilter.mode === 'range' && activeFilter.dateRange?.from && activeFilter.dateRange?.to) {
                    // Format to YYYY-MM-DD to strip local timezone info, which the backend will parse correctly.
                    params.startDate = format(activeFilter.dateRange.from, 'yyyy-MM-dd');
                    params.endDate = format(activeFilter.dateRange.to, 'yyyy-MM-dd');
                }


                const result = await getFeedbackSummary(params);
                setSummary(result.data as FeedbackSummary);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : "Failed to load feedback data.";
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [employeeId, activeFilter]);

    // --- RENDER LOGIC ---

    const renderChart = () => {
        if (!summary) return null;

        // Render LINE chart for range/full history
        if (summary.graphTimeseries) {
            const lineChartData = {
                labels: summary.graphTimeseries.labels,
                datasets: [
                    {
                        label: 'Understanding',
                        data: summary.graphTimeseries.understanding,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        tension: 0.3,
                        datalabels: {
                            display: false, // Hides labels for the "Understanding" line
                        }
                    },
                    {
                        label: 'Instructor',
                        data: summary.graphTimeseries.instructor,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        tension: 0.3,
                        datalabels: {
                            display: true, // Shows labels for the "Instructor" line
                            align: 'top' as const,
                            anchor: 'end' as const,
                            color: '#555',
                            font: { weight: 'bold' as const, size: 10 },
                            formatter: (value: number) => (value > 0 ? value.toFixed(1) : ''),
                        },
                    },
                ],
            };
            const lineChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' as const },
                    title: { display: true, text: `Daily Average Ratings`, font: { size: 16 } },
                },
                scales: { y: { beginAtZero: true, max: 5, title: { display: true, text: 'Rating (out of 5)' } } },
            };
            return <Line options={lineChartOptions} data={lineChartData} />;
        }

        // Render BAR chart for daily/monthly/specific summaries
        if (summary.graphData) {
            const barChartData = {
                labels: ['Understanding', 'Instructor'],
                datasets: [{
                    label: 'Average Rating',
                    data: [summary.graphData.avgUnderstanding, summary.graphData.avgInstructor],
                    backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                    borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)'],
                    borderWidth: 1,
                }],
            };
            const barChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: `Average Ratings`, font: { size: 16 } },
                    datalabels: {
                        display: true,
                        anchor: 'end' as const,
                        align: 'top' as const,
                        color: '#333',
                        font: { weight: 'bold' as const },
                        formatter: (value: number) => value.toFixed(2),
                    },
                },
                scales: { y: { beginAtZero: true, min: 0, max: 5, title: { display: true, text: 'Rating (out of 5)' } } }
            };
            return <Bar options={barChartOptions} data={barChartData} />;
        }

        return <p className="text-muted-foreground">No chart data available for this view.</p>;
    };


    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        }
        if (error) {
            return <div className="text-center text-red-500 py-10">{error}</div>;
        }
        if (!summary || (!summary.graphData && !summary.graphTimeseries)) {
            return <div className="text-center text-muted-foreground py-10">No feedback data found for this period.</div>;
        }
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="text-blue-500" /> Quantitative Feedback</CardTitle>
                        <CardDescription>Total Feedbacks Given: {summary.totalFeedbacks ?? 0}</CardDescription>
                    </CardHeader>
                    <CardContent style={{ height: '400px' }}>
                        {renderChart()}
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="text-yellow-500" /> AI Summary: Positive Feedback</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {summary.positiveFeedback?.length > 0 ? (
                                summary.positiveFeedback.map((fb, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                        <p className="italic text-gray-700 flex gap-2"><Quote className="h-4 w-4 text-gray-300 flex-shrink-0" /> {fb.quote}</p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {fb.keywords?.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                        </div>
                                    </div>
                                ))
                            ) : <p className="text-muted-foreground text-sm">No positive comments found for this period.</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="text-green-500" /> AI Summary: Areas for Improvement</CardTitle></CardHeader>
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

                    <Card className="p-4 mb-6">
                        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-4">
                            <Button onClick={() => setActiveFilter({ mode: "daily", date: new Date() })}>Today</Button>

                            <div className="flex items-center gap-2">
                                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Month" /></SelectTrigger>
                                    <SelectContent>
                                        {[...Array(12).keys()].map(i => <SelectItem key={i} value={String(i)}>{format(new Date(0, i), 'MMMM')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Year" /></SelectTrigger>
                                    <SelectContent>
                                        {[2025, 2024, 2023].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {/* This now correctly sets the date for the monthly filter */}
                                <Button onClick={() => setActiveFilter({ mode: 'monthly', date: new Date(selectedYear, selectedMonth, 1) })}>View Month</Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={"outline"} className={cn("w-[260px] justify-start text-left font-normal", !selectedDateRange && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDateRange?.from ? (selectedDateRange.to ? <>{format(selectedDateRange.from, "LLL dd, y")} - {format(selectedDateRange.to, "LLL dd, y")}</> : format(selectedDateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={selectedDateRange?.from}
                                            selected={selectedDateRange}
                                            onSelect={setSelectedDateRange}
                                            numberOfMonths={2}
                                            disabled={{ after: new Date() }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Button onClick={() => setActiveFilter({ mode: 'range', dateRange: selectedDateRange })} disabled={!selectedDateRange?.from || !selectedDateRange?.to}>Apply Range</Button>
                            </div>

                            <Button onClick={() => setActiveFilter({ mode: "full" })} variant="secondary">View Full History</Button>
                        </CardContent>
                    </Card>

                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
