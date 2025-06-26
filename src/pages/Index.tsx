import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import HomeStreakBanner from "@/components/HomeStreakBanner";
import AppNavbar from "@/components/AppNavbar"; // Keep AppNavbar here as requested for now
import { useUserAuth } from "@/context/UserAuthContext";
import { useAttendanceStreak } from "@/hooks/use-attendance-streak";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, getDocs, Timestamp, limit, orderBy } from "firebase/firestore";
import { AlertTriangle, CalendarPlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Index() {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const { attendanceStreak, attendanceLoading } = useAttendanceStreak();
  const [standupScheduled, setStandupScheduled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    async function checkTodayStandup() {
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
      setStandupScheduled(!standupSnapshot.empty);
    }
    checkTodayStandup();
  }, [user]);

  const isLoadingPageData = standupScheduled === null || attendanceLoading;

  return (
    // CHANGE: Changed bg-secondary/50 to bg-background for a pure white background
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.displayName?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's your dashboard for today.
            </p>
          </motion.div>

          {/* Main Content */}
          <div className="mt-8">
            {isLoadingPageData ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="md:col-span-1">
                  <HomeStreakBanner
                    attendanceStreak={attendanceStreak}
                    attendanceLoading={attendanceLoading}
                    isAdmin={false} // Assuming this is for regular users
                  />
                </div>
                {standupScheduled === false && (
                  <div className="md:col-span-2">
                    <Card className="bg-destructive/10 border-destructive/30 h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-destructive">
                          <AlertTriangle />
                          No Standup Scheduled Today!
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-destructive/80 mb-4">
                          There are no standups scheduled for today. Please let your admin know.
                        </p>
                        <Button
                          variant="destructive"
                          onClick={() => navigate("/standups")}
                        >
                          <CalendarPlus className="mr-2 h-4 w-4" />
                          View Standups Page
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}