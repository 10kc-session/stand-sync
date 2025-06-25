import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import HomeStreakBanner from "@/components/HomeStreakBanner";
import AppNavbar from "@/components/AppNavbar";

import { useUserAuth } from "@/context/UserAuthContext";
import { useAttendanceStreak } from "@/hooks/use-attendance-streak";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, getDocs, Timestamp, limit, orderBy } from "firebase/firestore";

export default function Index() {
  // This component now assumes a user is logged in.
  const { user } = useUserAuth();
  const navigate = useNavigate();

  const { attendanceStreak, attendanceLoading } = useAttendanceStreak();
  const [standupScheduled, setStandupScheduled] = useState<boolean | null>(null);

  // This effect fetches data for the dashboard.
  useEffect(() => {
    // The check for `user` is still good practice.
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
  }, [user]); // Rerun if the user changes

  // The page's own loading state for its data.
  // We consider it loading if the standup check hasn't finished yet.
  const isLoadingPageData = standupScheduled === null || attendanceLoading;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          {isLoadingPageData ? (
            <div className="text-muted-foreground">Loading dashboard...</div>
          ) : (
            <>
              {standupScheduled === false && (
                <div className="mb-7 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg p-5">
                  <div className="font-bold mb-2">No Standup Scheduled!</div>
                  <div className="mb-4">Let your admin know, or schedule one if you have permission.</div>
                  <Button
                    size="lg"
                    className="w-full font-bold"
                    onClick={() => navigate("/standups")}
                    data-testid="schedule-standup-home-btn"
                  >
                    Go to Standups Page
                  </Button>
                </div>
              )}
              <HomeStreakBanner
                attendanceStreak={attendanceStreak}
                attendanceLoading={attendanceLoading}
                isAdmin={false}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}