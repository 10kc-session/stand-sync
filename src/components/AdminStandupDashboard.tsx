/**
 * AdminStandupDashboard is a React component for administrators to manage and track daily standup attendance.
 *
 * Features:
 * - Loads today's scheduled standup from Firestore.
 * - Displays a list of employees and their attendance status for the current standup.
 * - Allows the admin to start the standup, which prepopulates attendance records for all employees.
 * - Provides real-time attendance updates using Firestore's onSnapshot listener.
 * - Enables toggling of individual employee attendance between "Present" and "Absent".
 * - Finalizes the standup, locking attendance and syncing results to a connected Google Sheet via Apps Script.
 * - Handles loading, error, and edge states (e.g., no standup scheduled).
 *
 * Integrations:
 * - Firebase Firestore for standup, employee, and attendance data.
 * - Google Apps Script endpoint for syncing attendance records to a Google Sheet.
 *
 * UI:
 * - Uses Card, Button, Checkbox, and Toast components for layout and feedback.
 *
 * State Management:
 * - Manages standup, employee list, attendance records, and UI state (started, finalized, loading).
 *
 * @component
 */
// src/components/AdminStandupDashboard.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

// Firebase imports
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  doc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";

// Types
type Employee = { id: string; name: string; email: string };
type Standup = { id: string; scheduled_at: Timestamp };
type Attendance = { id: string; employee_id: string; status: string | null };

// Your Apps Script endpoint
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzaRO0VUstPMLRbDPNQEHhpbrChn37aNVhfhS6mt0SJ_QCQ-wK78Un-LwETZiI1PqWdjw/exec";

const AdminStandupDashboard: React.FC = () => {
  const [todayStandup, setTodayStandup] = useState<Standup | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [started, setStarted] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Sync to Google Sheet
  const syncToSheet = useCallback(async () => {
    if (!todayStandup || employees.length === 0) return;
    try {
      const payload = employees.map(emp => ({
        standup_id: todayStandup.id,
        standup_time: todayStandup.scheduled_at.toDate().toLocaleString(),
        employee_id: emp.id,
        employee_name: emp.name,
        employee_email: emp.email,
        status: attendance[emp.id]?.status || "Absent",
      }));
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: payload }),
      });
    } catch (err) {
      console.error("Sheet sync error", err);
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [todayStandup, employees, attendance, toast]);

  // 1) Load today’s standup (once)
  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const q = query(
        collection(db, "standups"),
        where("scheduled_at", ">=", Timestamp.fromDate(today)),
        where("scheduled_at", "<", Timestamp.fromDate(tomorrow)),
        orderBy("scheduled_at", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        setTodayStandup({ id: doc.id, ...(doc.data() as any) });
      }
    })();
  }, []);

  // 2) Load employee list when standup is known
  useEffect(() => {
    if (!todayStandup) return;
    (async () => {
      const snap = await getDocs(collection(db, "employees"));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, [todayStandup]);

  // 3) Real‐time attendance listener once “started”
  useEffect(() => {
    if (!todayStandup || !started) return;
    const q = query(
      collection(db, "attendance"),
      where("standup_id", "==", todayStandup.id)
    );
    const unsub = onSnapshot(q, ss => {
      const map: Record<string, Attendance> = {};
      ss.docs.forEach(d => {
        const data = d.data() as Attendance;
        map[data.employee_id] = { id: d.id, ...data };
      });
      setAttendance(map);
    });
    return unsub;
  }, [todayStandup, started]);

  // “Start Standup” — prepopulate attendance docs if missing
  const handleStart = async () => {
    if (!todayStandup || employees.length === 0) return;
    setLoading(true);

    // Create any missing attendance docs
    const batch = writeBatch(db);
    const existing = await getDocs(
      query(
        collection(db, "attendance"),
        where("standup_id", "==", todayStandup.id)
      )
    );
    const seen = new Set(existing.docs.map(d => (d.data() as any).employee_id));

    for (const emp of employees) {
      if (!seen.has(emp.id)) {
        const ref = doc(db, "attendance", `${todayStandup.id}_${emp.id}`);
        batch.set(ref, {
          standup_id: todayStandup.id,
          employee_id: emp.id,
          status: "Absent",
          scheduled_at: todayStandup.scheduled_at,
        });
      }
    }
    await batch.commit();
    setStarted(true);
    toast({ title: "Standup started!" });
    setLoading(false);

    // first sheet sync
    setTimeout(syncToSheet, 500);
  };

  // Toggle present/absent
  const toggleAttendance = async (empId: string) => {
    if (finalized || !attendance[empId]) return;
    const docRef = doc(db, "attendance", attendance[empId].id);
    const newStatus = attendance[empId].status === "Present" ? "Absent" : "Present";
    await updateDoc(docRef, { status: newStatus });
    // schedule sheet sync shortly after
    setTimeout(syncToSheet, 300);
  };

  // “Stop Standup” — lock everything down
  const handleStop = () => {
    setFinalized(true);
    setStarted(false);
    toast({ title: "Standup finalized" });
    syncToSheet();
  };

  // If there’s no standup scheduled at all:
  if (!todayStandup) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>No standup scheduled today</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please ask an admin to schedule a standup for today.
          </p>
        </CardContent>
      </Card>
    );
  }

  const scheduledDate = todayStandup.scheduled_at.toDate();
  const now = new Date();
  const canStart = now >= scheduledDate;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>
          Standup at{" "}
          {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
          on {scheduledDate.toLocaleDateString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!started && !finalized ? (
          <Button
            onClick={handleStart}
            disabled={loading || !canStart}
            size="lg"
            className="w-full"
          >
            {canStart
              ? "Start Standup"
              : `Available at ${scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </Button>
        ) : (
          <>
            <div className="mb-4 font-semibold">Mark Attendance</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/10"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={attendance[emp.id]?.status === "Present"}
                      disabled={finalized}
                      onCheckedChange={() => toggleAttendance(emp.id)}
                      id={emp.id}
                    />
                    {emp.name}
                  </label>
                  <span
                    className={
                      attendance[emp.id]?.status === "Present"
                        ? "text-green-600"
                        : "text-orange-600"
                    }
                  >
                    {attendance[emp.id]?.status || "Absent"}
                  </span>
                </div>
              ))}
            </div>
            {!finalized && (
              <Button
                variant="destructive"
                onClick={handleStop}
                className="mt-4 w-full"
              >
                Stop Standup
              </Button>
            )}
            {finalized && (
              <p className="mt-4 font-semibold">
                Present:{" "}
                {
                  Object.values(attendance).filter((a) => a.status === "Present")
                    .length
                }{" "}
                / {employees.length}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminStandupDashboard;
