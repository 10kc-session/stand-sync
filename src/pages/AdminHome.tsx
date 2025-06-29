/**
 * AdminHome component displays the admin dashboard for managing standups and attendance.
 *
 * - Redirects to the admin login page if the admin is not authenticated.
 * - Fetches and displays a summary of today's standup and attendance count.
 * - Shows the total number of employees.
 * - Provides a button to schedule a standup if none is scheduled for today.
 * - Uses responsive design and animated transitions for a modern UI.
 *
 * @component
 * @returns {JSX.Element} The rendered admin dashboard page.
 *
 * @remarks
 * - Relies on Firebase Firestore for fetching employees, standups, and attendance data.
 * - Uses context from `useAdminAuth` for authentication state.
 * - Utilizes UI components such as Card, Alert, and Button for layout and feedback.
 * - Employs Framer Motion for entry animation.
 */
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";

// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { Loader2, Gauge, Clock, Users, CalendarPlus, BellRing, AlertTriangle } from "lucide-react"; // Added icons
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; // Added Card component
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert component
import { motion } from "framer-motion"; // Added motion for animations

const AdminHome = () => {
  const { admin, loading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminLoading) return;
    if (!admin) navigate("/admin/login");
  }, [admin, adminLoading, navigate]);

  const [summary, setSummary] = useState<{
    standupTime: string | null;
    present: number;
  }>({ standupTime: null, present: 0 });

  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!admin) return;

    async function fetchSummaryAndEmployees() {
      setIsLoading(true);
      try {
        const employeesCollection = collection(db, "employees");
        const snapshot = await getCountFromServer(employeesCollection);
        setEmployeeCount(snapshot.data().count);

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
        const standupSnapshot = await getDocs(standupsQuery);

        if (!standupSnapshot.empty) {
          const standupDoc = standupSnapshot.docs[0];
          const standup = { id: standupDoc.id, ...standupDoc.data() } as { id: string, scheduledTime: Timestamp };

          const attendanceQuery = query(collection(db, "attendance"), where("standup_id", "==", standup.id));
          const attendanceSnapshot = await getDocs(attendanceQuery);

          const presentCount = attendanceSnapshot.docs.filter(
            (doc) => doc.data().status === "Present"
          ).length;

          const standupTime = standup.scheduledTime.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          setSummary({ standupTime, present: presentCount });
        } else {
          setSummary({ standupTime: null, present: 0 });
        }
      } catch (error) {
        console.error("Failed to fetch admin summary:", error);
        setSummary({ standupTime: null, present: 0 });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSummaryAndEmployees();
  }, [admin]);

  const handleScheduleStandup = () => {
    navigate("/standups");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex items-center justify-center p-3 md:p-4"> {/* Responsive padding */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="p-4 md:p-6 shadow-lg"> {/* Responsive padding */}
            <CardHeader className="flex flex-row items-center justify-between pb-3 md:pb-4"> {/* Responsive padding */}
              <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold">Admin Dashboard</CardTitle> {/* Responsive text */}
              <Gauge className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-primary" /> {/* Responsive icon */}
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 md:mb-6 bg-blue-50 border-blue-200 text-blue-700"> {/* Responsive margin */}
                <BellRing className="h-4 w-4" />
                <AlertTitle className="text-sm md:text-base">Welcome!</AlertTitle> {/* Responsive text */}
                <AlertDescription className="text-xs md:text-sm"> {/* Responsive text */}
                  <span className="font-bold text-blue-800">
                    {admin?.email ? admin.email.split("@")[0] : "Admin"}!
                  </span>
                  <br />
                  Manage your team's standups and attendance.
                </AlertDescription>
              </Alert>

              {isLoading ? (
                <div className="flex flex-col md:flex-row justify-center items-center py-4 md:py-6"> {/* Responsive layout */}
                  <Loader2 className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 animate-spin text-primary" /> {/* Responsive size */}
                  <span className="ml-0 mt-2 md:mt-0 md:ml-3 text-sm md:text-base text-muted-foreground">Loading summary...</span> {/* Responsive text */}
                </div>
              ) : summary.standupTime ? (
                <div className="space-y-3 md:space-y-4 text-base md:text-lg font-semibold text-foreground"> {/* Responsive spacing and text */}
                  <div className="flex items-center gap-2 md:gap-3"> {/* Responsive gap */}
                    <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" /> {/* Responsive icon */}
                    <div className="flex flex-wrap items-center"> {/* Wrap text on small screens */}
                      <span>Today's Standup:</span>
                      <span className="ml-1 md:ml-2 text-primary font-bold"> {/* Adjusted margin */}
                        {summary.standupTime}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3"> {/* Responsive gap */}
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" /> {/* Responsive icon */}
                    <div className="flex flex-wrap items-center"> {/* Wrap text on small screens */}
                      <span>Attendance:</span>
                      <span className="ml-1 md:ml-2 text-green-700 font-bold"> {/* Adjusted margin */}
                        {summary.present} / {employeeCount}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Alert className="mb-4 md:mb-6 bg-orange-50 border-orange-200 text-orange-700"> {/* Responsive margin */}
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm md:text-base">No Standup Today</AlertTitle> {/* Responsive text */}
                    <AlertDescription className="text-xs md:text-sm"> {/* Responsive text */}
                      There is no standup scheduled for today.
                    </AlertDescription>
                  </Alert>
                  {/* Responsive text and margin */}
                  <Button
                    size="lg"
                    className="w-full mt-4 md:mt-6 font-bold text-sm md:text-base"
                    onClick={handleScheduleStandup}
                    data-testid="admin-schedule-standup-home-btn"
                  >
                    Schedule Standup <CalendarPlus className="ml-2 h-4 w-4 md:h-5 md:w-5" /> {/* Responsive icon */}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminHome;