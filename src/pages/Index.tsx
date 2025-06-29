/**
 * The main dashboard page for regular (non-admin) users.
 * 
 * Displays a personalized feedback summary, attendance streak, and standup status.
 * Allows filtering feedback data by day, month, date range, or full history.
 * 
 * Features:
 * - Redirects admin users to the admin dashboard.
 * - Fetches and displays the logged-in employee's profile.
 * - Shows standup attendance streak and current standup status.
 * - Fetches and visualizes feedback summary data (quantitative and qualitative) using Chart.js.
 * - Provides filter controls for daily, monthly, range, and full-history views.
 * - Responsive layout for mobile and desktop.
 * 
 * Dependencies:
 * - React, React Router, Firebase Firestore & Functions, Chart.js, Framer Motion, date-fns, custom UI components.
 * 
 * @component
 * @returns {JSX.Element} The user dashboard page.
 */
import { useState, useEffect, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom"; // Added Navigate
import { Button } from "@/components/ui/button";
import AppNavbar from "@/components/AppNavbar";
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from '@/context/AdminAuthContext'; // Ensure correct import
import { useAttendanceStreak } from "@/hooks/use-attendance-streak";
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  AlertTriangle,
  Loader2,
  Sparkles,
  MessageSquare,
  Quote,
  Lightbulb,
  Calendar as CalendarIcon,
  Flame,
  CheckSquare,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Chart.js imports and registration
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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line, Bar } from 'react-chartjs-2';

import { getFunctions, httpsCallable } from "firebase/functions";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

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

// --- Type Definitions ---
type EmployeeData = {
  name: string;
  firebaseUid: string;
  customEmployeeId: string;
};

type SummaryGraphData = {
  totalFeedbacks: number;
  avgUnderstanding: number;
  avgInstructor: number;
};
type TimeseriesGraphData = {
  labels: string[];
  understanding: number[];
  instructor: number[];
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

type ActiveFilter = {
  mode: "daily" | "monthly" | "specific" | "range" | "full";
  date?: Date;
  dateRange?: DateRange;
};

export default function Index() {
  const { user, loading: userAuthLoading } = useUserAuth();
  const { admin, initialized: adminInitialized } = useAdminAuth(); // Get initialization state
  const navigate = useNavigate();
  const { attendanceStreak, attendanceLoading: attendanceHookLoading } = useAttendanceStreak();

  // NEW: Immediate redirect if admin
  if (adminInitialized && admin) {
    return <Navigate to="/admin" replace />;
  }

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const [standupStatus, setStandupStatus] = useState<'scheduled' | 'active' | 'ended' | null>(null);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [loggedInEmployeeData, setLoggedInEmployeeData] = useState<EmployeeData | null>(null);

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ mode: "daily", date: new Date() });
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);

  // Fetch employee profile
  useEffect(() => {
    if (userAuthLoading || attendanceHookLoading) return;

    if (!user?.uid) {
      setPageError("You must be logged in to view this page.");
      setIsPageLoading(false);
      return;
    }

    const fetchEmployee = async () => {
      try {
        const employeesRef = collection(db, 'employees');
        const q = query(employeesRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          setLoggedInEmployeeData({
            name: data.name || 'Your Name',
            firebaseUid: docSnap.id,
            customEmployeeId: data.employeeId || 'N/A',
          });
        } else {
          setPageError("Could not find your employee profile. Please contact an admin.");
        }
      } catch (err) {
        console.error("Error fetching employee profile:", err);
        setPageError("Failed to load your dashboard data.");
      }
    };

    fetchEmployee();
  }, [user, userAuthLoading, attendanceHookLoading]);

  useEffect(() => {
    if (!user?.uid) {
      setStandupStatus(null);
      setIsPageLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);


    const standupsQuery = query(
      collection(db, "standups"),
      where("scheduledTime", ">=", Timestamp.fromDate(today)),
      where("scheduledTime", "<", Timestamp.fromDate(tomorrow)),
      orderBy("scheduledTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      standupsQuery,
      (snapshot) => {

        if (snapshot.empty) {
          setStandupStatus(null);
        } else {
          const data = snapshot.docs[0].data();
          setStandupStatus(data.status as "scheduled" | "active" | "ended");
        }
        setIsPageLoading(false);
      },
      (error) => {
        console.error("[Standup] listener error:", error);
        setPageError("Could not load standup info.");
        setIsPageLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);


  // Fetch feedback summary separately
  const fetchFeedbackSummary = useCallback(async () => {
    if (!loggedInEmployeeData?.firebaseUid) return;

    setIsFeedbackLoading(true);
    try {
      const functions = getFunctions();
      const getFeedbackSummaryCallable = httpsCallable(functions, "getFeedbackSummary");

      const params: any = {
        employeeId: loggedInEmployeeData.firebaseUid,
        timeFrame: activeFilter.mode,
      };

      if (activeFilter.mode === 'monthly' && activeFilter.date) {
        params.date = new Date(Date.UTC(activeFilter.date.getFullYear(), activeFilter.date.getMonth(), 1)).toISOString();
      } else if (activeFilter.mode === 'daily' || activeFilter.mode === 'specific') {
        params.date = activeFilter.date?.toISOString();
      } else if (activeFilter.mode === 'range' && activeFilter.dateRange?.from && activeFilter.dateRange?.to) {
        params.startDate = format(activeFilter.dateRange.from, 'yyyy-MM-dd');
        params.endDate = format(activeFilter.dateRange.to, 'yyyy-MM-dd');
      }

      const result = await getFeedbackSummaryCallable(params);
      setSummary(result.data as FeedbackSummary);
    } catch (err) {
      console.error("Error fetching feedback summary:", err);
      setPageError("Failed to load your feedback summary.");
    } finally {
      setIsFeedbackLoading(false);
    }
  }, [loggedInEmployeeData, activeFilter]);

  // Fetch feedback when filter changes or employee data is available
  useEffect(() => {
    if (loggedInEmployeeData) {
      fetchFeedbackSummary();
    }
  }, [loggedInEmployeeData, activeFilter, fetchFeedbackSummary]);

  const renderChart = () => {
    if (!summary) return null;

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
            datalabels: { display: false }
          },
          {
            label: 'Instructor',
            data: summary.graphTimeseries.instructor,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            tension: 0.3,
            datalabels: {
              display: true, align: 'top' as const, anchor: 'end' as const,
              color: '#555', font: { weight: 'bold' as const, size: 10 },
              formatter: (value: number) => (value > 0 ? value.toFixed(1) : ''),
            },
          },
        ],
      };
      const lineChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' as const },
          title: { display: true, text: `Daily Average Ratings`, font: { size: 16 } },
        },
        scales: { y: { beginAtZero: true, max: 5, title: { display: true, text: 'Rating (out of 5)' } } },
      };
      return <Line options={lineChartOptions} data={lineChartData} />;
    }

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
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Average Ratings`, font: { size: 16 } },
          datalabels: {
            display: true, anchor: 'end' as const, align: 'top' as const,
            color: '#333', font: { weight: 'bold' as const },
            formatter: (value: number) => value.toFixed(2),
          },
        },
        scales: { y: { beginAtZero: true, min: 0, max: 5, title: { display: true, text: 'Rating (out of 5)' } } }
      };
      return <Bar options={barChartOptions} data={barChartData} />;
    }

    return <p className="text-muted-foreground">No chart data available for this view.</p>;
  };

  const renderFeedbackDashboardContent = () => {
    if (pageError) {
      return <div className="text-center text-red-500 py-10">{pageError}</div>;
    }

    if (isFeedbackLoading) {
      return (
        <div className="flex justify-center items-center h-[300px] w-full">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="ml-2">Loading feedback...</span>
        </div>
      );
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
                  <div key={index} className="p-3 bg-secondary rounded-lg border border-border">
                    <p className="italic text-foreground flex gap-2"><Quote className="h-4 w-4 text-muted-foreground flex-shrink-0" /> {fb.quote}</p>
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
                  <div key={index} className="p-3 bg-secondary rounded-lg border border-border">
                    <p className="font-semibold text-foreground">{item.theme}</p>
                    <p className="text-sm text-muted-foreground">{item.suggestion}</p>
                  </div>
                ))
              ) : <p className="text-muted-foreground text-sm">No specific improvement areas found.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const CompactAttendanceStreak = () => (
    <div className="flex items-center gap-2 bg-background p-3 rounded-lg border shadow-sm">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">Standup Attendance Streak</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold">{attendanceStreak}</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      </div>
      {attendanceStreak === 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-2 text-xs h-6"
          onClick={() => navigate("/standups")}
        >
          Join standup
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6"> {/* Responsive padding */}
          {isPageLoading ? (
            <div className="flex justify-center items-center h-[40vh] w-full">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Top Section: Header with Attendance Streak */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4"> {/* Responsive gap */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"> {/* Responsive text */}
                    Hello, {user?.displayName?.split(' ')[0] || 'User'}!
                  </h1>
                  {loggedInEmployeeData && (
                    <div className="mt-1 sm:mt-2"> {/* Responsive margin */}
                      <h3 className="text-base sm:text-lg font-semibold">Your Feedback Summary</h3> {/* Responsive text */}
                      <p className="text-muted-foreground text-xs sm:text-sm"> {/* Responsive text */}
                        Viewing data for: <strong>{loggedInEmployeeData.name}</strong> (ID: {loggedInEmployeeData.customEmployeeId})
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start md:items-end gap-2 mt-2 md:mt-0"> {/* Responsive alignment */}
                  <CompactAttendanceStreak />
                  {/* Standup status indicators */}
                  {!pageError && standupStatus === 'scheduled' && (
                    <div className="flex items-center gap-2 text-blue-700 text-xs sm:text-sm bg-blue-50 p-2 rounded-lg border border-blue-200 w-full md:w-auto"> {/* Responsive width */}
                      <CalendarIcon className="h-4 w-4" />
                      <span>Standup is scheduled for today!</span>
                    </div>
                  )}
                  {!pageError && standupStatus === 'ended' && (
                    <div className="flex items-center gap-2 text-green-700 text-xs sm:text-sm bg-green-50 p-2 rounded-lg border border-green-200 w-full md:w-auto"> {/* Responsive width */}
                      <CheckSquare className="h-4 w-4" />
                      <span>Standup has been completed.</span>
                    </div>
                  )}
                  {!pageError && standupStatus === null && !isPageLoading && (
                    <div className="flex items-center gap-2 text-orange-700 text-xs sm:text-sm bg-orange-50 p-2 rounded-lg border border-orange-200 w-full md:w-auto"> {/* Responsive width */}
                      <AlertTriangle className="h-4 w-4" />
                      <span>No standup scheduled today.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Filters Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 sm:mt-6"
              >
                <Card className="p-3 sm:p-4"> {/* Responsive padding */}
                  <CardHeader className="p-0 pb-3 sm:pb-4"> {/* Responsive padding */}
                    <CardTitle className="text-base sm:text-lg">Filters</CardTitle> {/* Responsive text */}
                  </CardHeader>
                  <CardContent className="p-0 flex flex-wrap items-center gap-2 sm:gap-4"> {/* Responsive gap */}
                    {/* Today button */}
                    <div className="w-full sm:w-auto">
                      <Button
                        onClick={() => setActiveFilter({ mode: "daily", date: new Date() })}
                        variant={activeFilter.mode === "daily" ? "default" : "outline"}
                        size="sm"
                        className="w-full sm:w-auto" // Full width on mobile
                      >
                        Today
                      </Button>
                    </div>

                    {/* Month selector */}
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2"> {/* Responsive layout */}
                      <div className="flex w-full gap-2">
                        <Select
                          value={String(selectedMonth)}
                          onValueChange={(val) => setSelectedMonth(Number(val))}
                        >
                          <SelectTrigger className="w-full sm:w-[120px]"> {/* Responsive width */}
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(12).keys()].map(i => (
                              <SelectItem key={i} value={String(i)}>
                                {format(new Date(0, i), 'MMMM')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(selectedYear)}
                          onValueChange={(val) => setSelectedYear(Number(val))}
                        >
                          <SelectTrigger className="w-full sm:w-[90px]"> {/* Responsive width */}
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {[2025, 2024, 2023].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => setActiveFilter({
                          mode: 'monthly',
                          date: new Date(selectedYear, selectedMonth, 1)
                        })}
                        variant={activeFilter.mode === "monthly" ? "default" : "outline"}
                        size="sm"
                        className="w-full sm:w-auto" // Full width on mobile
                      >
                        View Month
                      </Button>
                    </div>

                    {/* Date range selector */}
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2"> {/* Responsive layout */}
                      <div className="w-full">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="date"
                              variant={"outline"}
                              className={cn("w-full justify-start text-left font-normal text-sm", !selectedDateRange && "text-muted-foreground")} // Full width
                              size="sm"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDateRange?.from ?
                                (selectedDateRange.to ?
                                  <>{format(selectedDateRange.from, "LLL dd")} - {format(selectedDateRange.to, "LLL dd, y")}</> :
                                  format(selectedDateRange.from, "LLL dd, y")
                                ) :
                                <span>Pick a date range</span>
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[90vw] sm:w-auto p-0" align="start"> {/* Responsive width */}
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={selectedDateRange?.from}
                              selected={selectedDateRange}
                              onSelect={setSelectedDateRange}
                              numberOfMonths={1} // Single month on mobile
                              disabled={{ after: new Date() }}
                              className="w-full"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button
                        onClick={() => setActiveFilter({
                          mode: 'range',
                          dateRange: selectedDateRange
                        })}
                        disabled={!selectedDateRange?.from || !selectedDateRange?.to}
                        variant={activeFilter.mode === "range" ? "default" : "outline"}
                        size="sm"
                        className="w-full sm:w-auto" // Full width on mobile
                      >
                        Apply Range
                      </Button>
                    </div>

                    {/* Full history button */}
                    <div className="w-full sm:w-auto">
                      <Button
                        onClick={() => setActiveFilter({ mode: "full" })}
                        variant={activeFilter.mode === "full" ? "default" : "outline"}
                        size="sm"
                        className="w-full sm:w-auto" // Full width on mobile
                      >
                        View Full History
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Feedback Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-4 sm:mt-6"
              >
                {renderFeedbackDashboardContent()}
              </motion.div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}