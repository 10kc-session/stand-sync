import React, { useEffect, useState } from "react";
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
  const { admin } = useAdminAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<{
    standupTime: string | null;
    present: number;
  }>({ standupTime: null, present: 0 });

  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!admin) navigate("/admin/login");
  }, [admin, navigate]);

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
          where("scheduled_at", ">=", Timestamp.fromDate(today)),
          where("scheduled_at", "<", Timestamp.fromDate(tomorrow)),
          orderBy("scheduled_at", "desc"),
          limit(1)
        );
        const standupSnapshot = await getDocs(standupsQuery);

        if (!standupSnapshot.empty) {
          const standupDoc = standupSnapshot.docs[0];
          const standup = { id: standupDoc.id, ...standupDoc.data() } as { id: string, scheduled_at: Timestamp };

          const attendanceQuery = query(collection(db, "attendance"), where("standup_id", "==", standup.id));
          const attendanceSnapshot = await getDocs(attendanceQuery);

          const presentCount = attendanceSnapshot.docs.filter(
            (doc) => doc.data().status === "Present"
          ).length;

          const standupTime = standup.scheduled_at.toDate().toLocaleTimeString([], {
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
      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="p-6 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-3xl font-bold">Admin Dashboard</CardTitle>
              <Gauge className="h-8 w-8 text-primary" />
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-700">
                <BellRing className="h-4 w-4" />
                <AlertTitle>Welcome!</AlertTitle>
                <AlertDescription>
                  {/* CHANGED: Fallback to email, then 'Admin' */}
                  Welcome, <span className="font-bold text-blue-800">{admin?.email || 'Admin'}!</span>
                  Manage your team's standups and attendance.
                </AlertDescription>
              </Alert>

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-lg text-muted-foreground">Loading summary...</span>
                </div>
              ) : summary.standupTime ? (
                <div className="space-y-4 text-lg font-semibold text-foreground">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span>Today's Standup:</span>
                    <span className="ml-2 text-primary font-bold">
                      {summary.standupTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>Attendance:</span>
                    <span className="ml-2 text-green-700 font-bold">
                      {summary.present} / {employeeCount}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <Alert className="mb-6 bg-orange-50 border-orange-200 text-orange-700">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No Standup Today</AlertTitle>
                    <AlertDescription>
                      There is no standup scheduled for today.
                    </AlertDescription>
                  </Alert>
                  <Button
                    size="lg"
                    className="w-full mt-6 font-bold"
                    onClick={handleScheduleStandup}
                    data-testid="admin-schedule-standup-home-btn"
                  >
                    Schedule Standup <CalendarPlus className="ml-2 h-5 w-5" />
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