/**
 * AdminScheduleStandup component allows admin users to schedule new standup meetings
 * and view all scheduled standups.
 *
 * Features:
 * - Displays a form for selecting a time and scheduling a standup for today.
 * - Lists all scheduled standups, ordered by scheduled time.
 * - Prevents scheduling standups in the past.
 * - Only authenticated admins can schedule standups.
 * - Shows feedback via toast notifications for success and error cases.
 *
 * Uses Firebase Firestore for data storage and retrieval.
 *
 * @component
 * @returns {JSX.Element} The rendered AdminScheduleStandup card UI.
 *
 * @remarks
 * Requires the user to be authenticated as an admin via `useAdminAuth`.
 * Relies on Firebase client integration and UI components from the local project.
 */
// src/components/AdminScheduleStandup.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Firebase imports
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

type Standup = {
  id: string;
  scheduled_at: Timestamp;
  created_at?: Timestamp;
  created_by?: string;
};

export default function AdminScheduleStandup() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();

  const [time, setTime] = useState("");
  const [standups, setStandups] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all scheduled standups, memoized so effect deps are stable
  const fetchStandups = useCallback(async () => {
    setLoading(true);
    try {
      const standupsRef = collection(db, "standups");
      const q = query(standupsRef, orderBy("scheduled_at", "asc"));
      const snap = await getDocs(q);
      setStandups(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Standup))
      );
    } catch (err: any) {
      console.error("Error fetching standups:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStandups();
  }, [fetchStandups]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only admins may schedule
    if (!admin) {
      toast({ title: "Forbidden", description: "Only admins can schedule standups.", variant: "destructive" });
      return;
    }
    if (!time) {
      toast({ title: "Invalid", description: "Please select a time.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Build the scheduled Date
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);

      // Prevent scheduling in the past (for today)
      const nowClean = new Date();
      nowClean.setSeconds(0, 0);
      if (scheduledDate.getTime() < nowClean.getTime()) {
        toast({ title: "Invalid", description: "Cannot schedule a past time.", variant: "destructive" });
        return;
      }

      // Prepare Firestore insert
      const insertObj: any = {
        scheduled_at: Timestamp.fromDate(scheduledDate),
        created_at: serverTimestamp(),
        created_by: admin.uid,
      };

      await addDoc(collection(db, "standups"), insertObj);
      toast({ title: "Success", description: "Standup scheduled." });
      setTime("");
      await fetchStandups();
    } catch (err: any) {
      console.error("Error scheduling standup:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Helper to set time input to now
  const setToNowTime = () => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    setTime(`${hh}:${mm}`);
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-8">
      <CardHeader>
        <CardTitle>Schedule Standup</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSchedule} className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span>Today at:</span>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-28"
              min="00:00"
              max="23:59"
              data-testid="schedule-time-input"
            />
            <Button size="sm" variant="ghost" onClick={setToNowTime} data-testid="now-btn">
              Now
            </Button>
          </div>
          <Button type="submit" disabled={loading} data-testid="add-btn">
            {loading ? "Scheduling..." : "Add"}
          </Button>
        </form>

        <h4 className="font-semibold mb-2">All Scheduled Standups</h4>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ul className="space-y-3">
            {standups.length ? (
              standups.map((su) => (
                <li key={su.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div>
                      <strong>
                        {su.scheduled_at.toDate().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>{" "}
                      on{" "}
                      {su.scheduled_at.toDate().toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    {su.created_by && (
                      <div className="text-xs text-muted-foreground">
                        Scheduled by: {su.created_by}
                      </div>
                    )}
                  </div>
                  {su.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {su.created_at.toDate().toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No standups scheduled.</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
