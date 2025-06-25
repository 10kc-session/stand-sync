import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

// --- Firebase Imports ---
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

// --- Type Definitions for Firestore ---
type Employee = { id: string; name: string; email: string };
type Standup = { id: string; scheduled_at: Timestamp };
type Attendance = { id: string; employee_id: string; status: string | null };

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzaRO0VUstPMLRbDPNQEHhpbrChn37aNVhfhS6mt0SJ_QCQ-wK78Un-LwETZiI1PqWdjw/exec";


const AdminStandupDashboard: React.FC = () => {
  const [todayStandup, setTodayStandup] = useState<Standup | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [start, setStart] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast(); // Toast is initialized here

  // --- syncAttendanceToSheet function is now INSIDE the component ---
  const syncAttendanceToSheet = useCallback(async () => {
    // It can now access component state directly without arguments
    if (!todayStandup || employees.length === 0) return;

    try {
      const dataToSend = employees.map((emp) => ({
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
        body: JSON.stringify({ records: dataToSend }),
      });
    } catch (err) {
      console.error("Sheet sync error:", err);
      // It can now correctly call toast() because it's in scope
      toast({
        title: "Google Sheet sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [todayStandup, employees, attendance, toast]);


  // 1. Fetch today's standup
  useEffect(() => {
    const fetchTodayStandup = async () => {
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
        const doc = standupSnapshot.docs[0];
        setTodayStandup({ id: doc.id, ...doc.data() } as Standup);
      } else {
        setTodayStandup(null);
      }
    };
    fetchTodayStandup();
  }, []);

  // 2. Fetch employees
  useEffect(() => {
    if (!todayStandup) return;
    const fetchEmployees = async () => {
      const querySnapshot = await getDocs(collection(db, "employees"));
      setEmployees(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    };
    fetchEmployees();
  }, [todayStandup]);

  // 3. Set up REAL-TIME listener for attendance
  useEffect(() => {
    if (!todayStandup || !start) return;

    const q = query(collection(db, "attendance"), where("standup_id", "==", todayStandup.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const attMap: Record<string, Attendance> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Attendance;
        attMap[data.employee_id] = { id: doc.id, ...data };
      });
      setAttendance(attMap);
    });

    return () => unsubscribe();
  }, [todayStandup, start]);

  const handleStart = async () => {
    if (!todayStandup || employees.length === 0) return;
    setLoading(true);

    const batch = writeBatch(db);
    const existingAttendanceSnapshot = await getDocs(query(collection(db, "attendance"), where("standup_id", "==", todayStandup.id)));
    const existingIds = new Set(existingAttendanceSnapshot.docs.map(d => d.data().employee_id));

    for (let emp of employees) {
      if (!existingIds.has(emp.id)) {
        const attendanceDocId = `${todayStandup.id}_${emp.id}`;
        const attendanceDocRef = doc(db, "attendance", attendanceDocId);
        batch.set(attendanceDocRef, {
          standup_id: todayStandup.id,
          employee_id: emp.id,
          status: "Absent",
          scheduled_at: todayStandup.scheduled_at,
        });
      }
    }
    await batch.commit();
    setStart(true);
    toast({ title: "Standup started!" });
    setLoading(false);
    setTimeout(syncAttendanceToSheet, 1000);
  };

  const handleCheckbox = async (employeeId: string) => {
    if (!todayStandup || finalized) return;
    const prevStatus = attendance[employeeId]?.status;
    const newStatus = prevStatus === "Present" ? "Absent" : "Present";
    const attendanceDocId = `${todayStandup.id}_${employeeId}`;
    const attendanceDocRef = doc(db, "attendance", attendanceDocId);

    try {
      await updateDoc(attendanceDocRef, { status: newStatus });
      setTimeout(syncAttendanceToSheet, 400);
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    }
  };

  const handleStop = () => {
    setFinalized(true);
    setStart(false);
    toast({ title: "Standup finalized", description: "Attendance is locked for today" });
    syncAttendanceToSheet();
  };

  const scheduledDate = todayStandup ? todayStandup.scheduled_at.toDate() : null;
  const now = new Date();
  const canStart = todayStandup && scheduledDate ? now.getTime() >= scheduledDate.getTime() : false;

  // The rest of the JSX is unchanged...

  if (!todayStandup) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>No standup scheduled today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Schedule a standup for today from above.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>
          Standup for {scheduledDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {scheduledDate?.toLocaleDateString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!start && !finalized ? (
          <Button onClick={handleStart} disabled={loading || employees.length === 0 || !canStart}>
            {canStart ? "Start Standup" : `Start available at ${scheduledDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </Button>
        ) : (
          <>
            <div className="mb-2 font-semibold">
              Mark attendance:
            </div>
            <div className="space-y-2">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={attendance[emp.id]?.status === "Present"}
                    disabled={finalized}
                    onCheckedChange={() => handleCheckbox(emp.id)}
                    id={`attendance-${emp.id}`}
                  />
                  <label htmlFor={`attendance-${emp.id}`}>{emp.name} ({emp.email})</label>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              {!finalized && (
                <Button variant="destructive" onClick={handleStop}>
                  Stop Standup
                </Button>
              )}
            </div>
            {finalized && (
              <div className="mt-4 border-t pt-3 font-semibold">
                Present:{" "}
                {Object.values(attendance).filter((a) => a.status === "Present").length} / {employees.length}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminStandupDashboard;