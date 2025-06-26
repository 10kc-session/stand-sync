import React, { useEffect, useState, useCallback } from "react";
// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

// --- Component Imports ---
import AppNavbar from "@/components/AppNavbar"; // RE-ADDED: AppNavbar is now included on this page
import AdminScheduleStandup from "@/components/AdminScheduleStandup"; // Assuming this component is styled internally
// import "./Attendance.css"; // REMOVED: Replaced with Tailwind/shadcn/ui styling

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CalendarPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// --- Type Definitions for Firestore ---
type Employee = { id: string; name: string; email: string };
type Standup = { id: string; scheduled_at: Timestamp };
type Attendance = { employee_id: string; status: string | null, standup_id: string };

export default function Standups() {
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [standup, setStandup] = useState<Standup | null>(null);
  const [standupCompleted, setStandupCompleted] = useState(false);
  const [standupStarted, setStandupStarted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedAttendance, setEditedAttendance] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setIsLoadingPage(true);
    try {
      const employeesCollection = collection(db, "employees");
      const empSnapshot = await getDocs(employeesCollection);
      const empData = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(empData);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const standupsCollection = collection(db, "standups");
      const q = query(
        standupsCollection,
        where("scheduled_at", ">=", Timestamp.fromDate(today)),
        where("scheduled_at", "<", Timestamp.fromDate(tomorrow)),
        orderBy("scheduled_at", "desc"),
        limit(1)
      );

      const standupSnapshot = await getDocs(q);
      if (!standupSnapshot.empty) {
        const standupDoc = standupSnapshot.docs[0];
        const standupData = { id: standupDoc.id, ...standupDoc.data() } as Standup;
        setStandup(standupData);

        const attendanceCollection = collection(db, "attendance");
        const attendanceQuery = query(attendanceCollection, where("standup_id", "==", standupData.id));
        const attSnapshot = await getDocs(attendanceQuery);

        const map: Record<string, Attendance> = {};
        attSnapshot.forEach((doc) => {
          const attDoc = doc.data() as Attendance;
          map[attDoc.employee_id] = attDoc;
        });
        setAttendance(map);

        setStandupCompleted(attSnapshot.size === empData.length && empData.length > 0);
      } else {
        setStandup(null);
        setAttendance({});
        setStandupCompleted(false);
      }
    } catch (error) {
      console.error("Failed to fetch standup data:", error);
      // Handle error state if needed
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScheduleReload = () => {
    fetchData();
  };

  const handleStartStandup = () => {
    setStandupStarted(true);
    setEditing(true);
    const initialEditedAttendance: Record<string, boolean> = {};
    employees.forEach(emp => {
      initialEditedAttendance[emp.id] = attendance[emp.id]?.status === "Present";
    });
    setEditedAttendance(initialEditedAttendance);
  };

  const handleAttendanceCheck = (empId: string, checked: boolean) => {
    setEditedAttendance(prev => ({ ...prev, [empId]: checked }));
  };

  const handleStopStandup = async () => {
    if (!standup) return;

    const batch = writeBatch(db);

    for (const emp of employees) {
      const empStatus = editedAttendance[emp.id] ? "Present" : "Missed";
      const attendanceDocId = `${standup.id}_${emp.id}`;
      const attendanceDocRef = doc(db, "attendance", attendanceDocId);

      const dataToSet = {
        standup_id: standup.id,
        employee_id: emp.id,
        status: empStatus,
        scheduled_at: standup.scheduled_at
      };

      batch.set(attendanceDocRef, dataToSet);
    }

    try {
      await batch.commit();
      await fetchData();
      setStandupStarted(false);
      setEditing(false);
      // setStandupCompleted is set by fetchData
    } catch (error) {
      console.error("Error saving attendance:", error);
      // Handle error display
    }
  };

  const renderContent = () => {
    if (isLoadingPage) {
      return (
        <div className="flex justify-center items-center h-full min-h-[300px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    // 1. No standup for today: Show ONLY schedule section
    if (!standup) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          {/* Assuming AdminScheduleStandup is designed to fit the minimalist theme */}
          <AdminScheduleStandup onAfterSchedule={handleScheduleReload} />
        </motion.div>
      );
    }

    // 2. Standup scheduled for today, but not started/completed
    if (standup && !standupStarted && !standupCompleted) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <Card className="text-center p-6 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Today's Standup</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-700">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Standup Scheduled</AlertTitle>
                <AlertDescription>
                  A standup meeting is scheduled for today. Click below to start marking attendance.
                </AlertDescription>
              </Alert>
              <Button
                size="lg"
                className="w-full font-bold"
                onClick={handleStartStandup}
              >
                Start Standup <CalendarPlus className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // 3. Standup started: Show attendance editing using checkboxes
    if (standup && standupStarted && !standupCompleted) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <Card className="p-6 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold mb-4">Mark Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold text-muted-foreground mb-4">
                Mark employees as Present or Missed.
              </p>
              {/* Added div for internal scrolling */}
              <div className="max-h-[300px] overflow-y-auto pr-2">
                <ul className="space-y-3">
                  {employees.map(emp => (
                    <li
                      key={emp.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md transition-colors duration-200 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`attendance-${emp.id}`}
                          checked={!!editedAttendance[emp.id]}
                          onCheckedChange={(checked) => handleAttendanceCheck(emp.id, checked as boolean)}
                          disabled={!editing}
                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-border"
                        />
                        <label
                          htmlFor={`attendance-${emp.id}`}
                          className={cn(
                            "text-lg font-medium cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                            editedAttendance[emp.id] ? "text-green-700" : "text-orange-700"
                          )}
                        >
                          {emp.name}
                        </label>
                      </div>
                      <span className={cn(
                        "text-sm font-semibold",
                        editedAttendance[emp.id] ? "text-green-600" : "text-orange-600"
                      )}>
                        {editedAttendance[emp.id] ? "Present" : "Missed"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div> {/* End of scrollable div */}
              <Button
                size="lg"
                className="w-full mt-8"
                onClick={handleStopStandup}
                disabled={!editing}
              >
                Stop Standup
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // 4. Standup completed: Show who attended (checkbox, disabled)
    if (standup && standupCompleted) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <Card className="p-6 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold mb-4">Team Standups</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-green-50 border-green-200 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Standup Completed!</AlertTitle>
                <AlertDescription>
                  Today's standup has concluded. See who joined below.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mb-4">
                Checkmarks show who attended today's standup.
              </p>
              {/* Added div for internal scrolling */}
              <div className="max-h-[300px] overflow-y-auto pr-2">
                <p className="text-lg font-semibold text-foreground mb-3">People</p>
                <ul className="space-y-3">
                  {employees.map(emp => {
                    const present = attendance[emp.id]?.status === "Present";
                    return (
                      <li
                        key={emp.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`attendance-view-${emp.id}`}
                            checked={present}
                            disabled
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-border"
                          />
                          <label
                            htmlFor={`attendance-view-${emp.id}`}
                            className={cn(
                              "text-lg font-medium",
                              present ? "text-green-700" : "text-orange-700",
                              "peer-disabled:opacity-70"
                            )}
                          >
                            {emp.name}
                          </label>
                        </div>
                        <span className={cn(
                          "text-sm font-semibold",
                          present ? "text-green-600" : "text-orange-600"
                        )}>
                          {present ? "Present" : "Missed"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div> {/* End of scrollable div */}
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    return null; // Fallback case
  };

  return (
    // Updated main container for minimalist background
    <div className="min-h-screen flex flex-col bg-background">
      {/* AppNavbar is included here as per your request */}
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl"> {/* Adjusted max-width for overall page content */}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}