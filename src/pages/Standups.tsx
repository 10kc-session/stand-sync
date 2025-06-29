/**
 * Standups Page
 *
 * This page manages the scheduling, activation, attendance marking, and completion of daily standup meetings for a team.
 * It supports both admin and regular user roles, providing real-time updates and attendance tracking via Firebase Firestore.
 *
 * Features:
 * - Admins can schedule a standup for today, specifying date and time.
 * - Real-time updates for standup status: scheduled, active, or ended.
 * - Admins can start the standup, mark attendance for each employee, and end the standup.
 * - Attendance is saved in Firestore and displayed after the standup ends.
 * - Regular users can view standup status and attendance results.
 *
 * Components:
 * - `ScheduleStandupForm`: Form for admins to schedule a standup.
 * - Main content dynamically renders based on standup status and user role.
 *
 * State Management:
 * - `standup`: Current standup document for today.
 * - `employees`: List of employees fetched from Firestore.
 * - `tempAttendance`: Temporary attendance state for marking during an active standup.
 * - `savedAttendance`: Attendance records fetched after standup ends.
 * - Loading and updating states for UI feedback.
 *
 * Firebase Integration:
 * - Uses Firestore for standup, employee, and attendance data.
 * - Real-time listeners for standup document.
 * - Batch writes for attendance records.
 *
 * UI:
 * - Uses Shadcn UI components, Framer Motion for animations, and Lucide icons.
 * - Responsive and accessible design.
 *
 * @module Standups
 * @file Standups.tsx
 */

import { useEffect, useState, useCallback } from "react";
import { format, setHours, setMinutes, startOfDay } from "date-fns"; // Added setHours, setMinutes

// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  getDocs,
  where,
  writeBatch, // <-- Add this import
} from "firebase/firestore";

// --- Context and Auth Hooks ---
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";

// --- Component Imports ---
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CalendarClock, PlayCircle, StopCircle, CheckCircle2, AlertTriangle, CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils"; // For combining tailwind classes

// --- Shadcn UI for Date/Time Picker ---
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input"; // For time input

// --- Type Definition for our Standup document ---
type Standup = {
  status: "scheduled" | "active" | "ended";
  scheduledTime: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  scheduledBy: string; // UID of the admin
  // Optionally, you could store a list of attendees or a summary here
  // But for detailed attendance, a separate collection is better.
};

// --- Type Definitions for Employees and Attendance ---
type Employee = { id: string; name: string; email: string };
type AttendanceRecord = { employee_id: string; status: "Present" | "Missed"; standup_id: string; scheduled_at: Timestamp };

// --- Schedule Standup Form Component ---
const ScheduleStandupForm = ({
  todayDocId,
  adminName,
}: {
  todayDocId: string;
  adminName: string;
}) => {
  const { toast } = useToast();
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [scheduledTimeInput, setScheduledTimeInput] = useState<string>(format(new Date(), 'HH:mm')); // HH:mm for 24-hour format

  const handleSchedule = async () => {
    if (!scheduledDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }

    const [hours, minutes] = scheduledTimeInput.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      toast({ title: "Error", description: "Please enter a valid time (HH:MM).", variant: "destructive" });
      return;
    }

    let finalScheduledDateTime = setHours(setMinutes(scheduledDate, minutes), hours);

    const now = new Date();
    // --- THIS IS THE FIX ---
    // Create a 'clean' version of the current time with no seconds/milliseconds
    const nowClean = new Date();
    nowClean.setSeconds(0, 0);
    // --- END OF FIX ---

    const todayFormatted = format(now, "yyyy-MM-dd");
    const selectedDateFormatted = format(finalScheduledDateTime, "yyyy-MM-dd");

    // Now, compare against the 'clean' time
    if (selectedDateFormatted === todayFormatted && finalScheduledDateTime.getTime() < nowClean.getTime()) {
      toast({ title: "Error", description: "Scheduled time cannot be in the past for today's standup.", variant: "destructive" });
      return;
    }


    setIsScheduling(true);
    try {
      const standupRef = doc(db, "standups", todayDocId);
      await setDoc(standupRef, {
        status: "scheduled",
        scheduledTime: Timestamp.fromDate(finalScheduledDateTime), // Use selected time
        scheduledBy: adminName,
      });
      toast({ title: "Success", description: `Standup has been scheduled for today at ${format(finalScheduledDateTime, 'p')}.` });
    } catch (error) {
      console.error("Error scheduling standup:", error);
      toast({ title: "Error", description: "Could not schedule standup.", variant: "destructive" });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <Card className="text-center p-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">No Standup Today</CardTitle>
        <CardDescription className="text-muted-foreground">
          There is no standup scheduled for today. Schedule one now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !scheduledDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {scheduledDate ? format(scheduledDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={scheduledDate}
              onSelect={setScheduledDate}
              initialFocus
              disabled={(date) => startOfDay(date) < startOfDay(new Date())}
            />
          </PopoverContent>
        </Popover>

        {/* Time Input */}
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={scheduledTimeInput}
            onChange={(e) => setScheduledTimeInput(e.target.value)}
            className="w-[120px]"
          />
        </div>

        <Button onClick={handleSchedule} disabled={isScheduling || !scheduledDate}>
          {isScheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
          Schedule Standup
        </Button>
      </CardContent>
    </Card>
  );
};

export default function Standups() {
  const { user } = useUserAuth();
  const { admin } = useAdminAuth(); // This hook should return `true` if the user is an admin
  const { toast } = useToast();

  const [isLoadingPage, setIsLoadingPage] = useState(true); // For initial page load
  const [standup, setStandup] = useState<Standup | null>(null);
  const [isUpdatingStandupStatus, setIsUpdatingStandupStatus] = useState(false); // For start/stop buttons

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tempAttendance, setTempAttendance] = useState<Record<string, boolean>>({}); // For marking attendance during active standup
  const [savedAttendance, setSavedAttendance] = useState<Record<string, AttendanceRecord>>({}); // For displaying once ended

  // Get today's date in 'YYYY-MM-DD' format to use as our document ID
  const todayDocId = format(new Date(), "yyyy-MM-dd");

  // --- Real-time Listener for Standup Document ---
  useEffect(() => {
    const standupRef = doc(db, "standups", todayDocId);

    const unsubscribe = onSnapshot(
      standupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setStandup(docSnap.data() as Standup);
        } else {
          setStandup(null);
        }
        setIsLoadingPage(false);
      },
      (error) => {
        console.error("Failed to listen to standup document:", error);
        toast({ title: "Error", description: "Could not connect to standup service.", variant: "destructive" });
        setIsLoadingPage(false);
      }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [todayDocId, toast]);

  // --- Fetch Employees and Attendance (if standup is ended) ---
  const fetchEmployeesAndAttendance = useCallback(async () => {
    setIsLoadingPage(true);
    try {
      // Fetch Employees
      const employeesCollection = collection(db, "employees");
      const empSnapshot = await getDocs(employeesCollection);
      const empData = empSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(empData);

      // If a standup exists and is ended, fetch its attendance
      if (standup && standup.status === "ended") {
        const attendanceCollection = collection(db, "attendance");
        // Query for attendance records related to today's standup
        const q = query(attendanceCollection, where("standup_id", "==", todayDocId));
        const attSnapshot = await getDocs(q);
        const fetchedAttendance: Record<string, AttendanceRecord> = {};
        attSnapshot.forEach((doc) => {
          const data = doc.data() as AttendanceRecord;
          fetchedAttendance[data.employee_id] = data;
        });
        setSavedAttendance(fetchedAttendance);
      } else {
        setSavedAttendance({}); // Clear saved attendance if standup is not ended
      }
    } catch (error) {
      console.error("Error fetching employees or attendance:", error);
      toast({ title: "Error", description: "Failed to load employee data.", variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [standup, todayDocId, toast]);

  // Call fetchEmployeesAndAttendance when standup status or component mounts
  useEffect(() => {
    fetchEmployeesAndAttendance();
  }, [fetchEmployeesAndAttendance]); // Depend on memoized function


  // --- Admin Action Handlers ---
  const handleStartStandup = async () => {
    setIsUpdatingStandupStatus(true);
    const standupRef = doc(db, "standups", todayDocId);

    // Initialize tempAttendance for all employees (default to Missed)
    const initialTempAttendance: Record<string, boolean> = {};
    employees.forEach(emp => {
      initialTempAttendance[emp.id] = false; // Default to missed
    });
    setTempAttendance(initialTempAttendance);

    try {
      await updateDoc(standupRef, {
        status: "active",
        startedAt: serverTimestamp(),
      });
      toast({ title: "Standup Started", description: "The standup is now active. Mark attendance." });
    } catch (error) {
      console.error("Error starting standup:", error);
      toast({ title: "Error", description: "Could not start the standup.", variant: "destructive" });
    } finally {
      setIsUpdatingStandupStatus(false);
    }
  };

  const handleAttendanceCheck = (empId: string, checked: boolean) => {
    setTempAttendance((prev) => ({ ...prev, [empId]: checked }));
  };

  const handleStopStandup = async () => {
    if (!standup) return;

    setIsUpdatingStandupStatus(true);
    try {
      const batch = writeBatch(db);
      const attendanceCollectionRef = collection(db, "attendance");

      for (const emp of employees) {
        const attendanceStatus = tempAttendance[emp.id] ? "Present" : "Missed";
        // Create a unique ID for each attendance record using standup ID and employee ID
        const attendanceDocRef = doc(attendanceCollectionRef, `${todayDocId}_${emp.id}`);
        batch.set(attendanceDocRef, {
          standup_id: todayDocId,
          employee_id: emp.id,
          employee_name: emp.name, // Store employee name for easier reference
          status: attendanceStatus,
          scheduled_at: standup.scheduledTime, // Store the scheduled time with attendance
          markedAt: serverTimestamp(), // When this specific record was marked
        });
      }
      await batch.commit();

      // 2. Update Standup Status to 'ended'
      const standupRef = doc(db, "standups", todayDocId);
      await updateDoc(standupRef, {
        status: "ended",
        endedAt: serverTimestamp(),
      });

      toast({ title: "Standup Ended", description: "The standup has been concluded and attendance saved." });
      // Re-fetch data to reflect the new "ended" state and display saved attendance
      await fetchEmployeesAndAttendance();
    } catch (error) {
      console.error("Error ending standup or saving attendance:", error);
      toast({ title: "Error", description: "Could not end the standup or save attendance.", variant: "destructive" });
    } finally {
      setIsUpdatingStandupStatus(false);
    }
  };

  // --- Main Render Logic ---
  const renderContent = () => {
    if (isLoadingPage) {
      return (
        <div className="flex justify-center items-center h-full min-h-[300px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    // 1. No standup for today: Show scheduling form only to admins, alert to users
    if (!standup) {
      return admin ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <ScheduleStandupForm todayDocId={todayDocId} adminName={user?.displayName || "Admin"} />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <Alert variant="default" className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">No Standup Scheduled</AlertTitle>
            <AlertDescription className="text-yellow-700">
              There is no standup scheduled for today. Please check back later.
            </AlertDescription>
          </Alert>
        </motion.div>
      );
    }

    // 2. Standup is Scheduled (but not active/ended)
    if (standup.status === "scheduled") {
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
                  A standup meeting is scheduled for today at {format(standup.scheduledTime.toDate(), 'p')}.
                  {admin && " Click below to start marking attendance."}
                </AlertDescription>
              </Alert>
              {admin && (
                <Button size="lg" className="w-full font-bold" onClick={handleStartStandup} disabled={isUpdatingStandupStatus}>
                  {isUpdatingStandupStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                  Start Standup
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // 3. Standup is Active: Show attendance marking for admins, status for users
    if (standup.status === "active") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg mx-auto"
        >
          <Card className="p-6 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold mb-4">
                {admin ? "Mark Attendance" : "Standup is LIVE"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-red-50 border-red-200 text-red-700">
                <PlayCircle className="h-4 w-4" />
                <AlertTitle className="text-red-800">Standup is LIVE!</AlertTitle>
                <AlertDescription className="text-red-700">
                  The standup is currently active.
                </AlertDescription>
              </Alert>

              {admin && (
                <>
                  <p className="text-sm font-semibold text-muted-foreground mb-4">
                    Mark employees as Present or Missed.
                  </p>
                  <div className="max-h-[300px] overflow-y-auto pr-2 mb-4">
                    <ul className="space-y-3">
                      {employees.map((emp) => (
                        <li
                          key={emp.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md transition-colors duration-200 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`attendance-${emp.id}`}
                              checked={!!tempAttendance[emp.id]}
                              onCheckedChange={(checked) => handleAttendanceCheck(emp.id, checked as boolean)}
                              disabled={isUpdatingStandupStatus}
                              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-border"
                            />
                            <label
                              htmlFor={`attendance-${emp.id}`}
                              className={cn(
                                "text-lg font-medium cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                                tempAttendance[emp.id] ? "text-green-700" : "text-orange-700"
                              )}
                            >
                              {emp.name}
                            </label>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              tempAttendance[emp.id] ? "text-green-600" : "text-orange-600"
                            )}
                          >
                            {tempAttendance[emp.id] ? "Present" : "Missed"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleStopStandup}
                    disabled={isUpdatingStandupStatus}
                  >
                    {isUpdatingStandupStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-5 w-5" />}
                    Stop Standup
                  </Button>
                </>
              )}
              {!admin && (
                <p className="text-muted-foreground text-center mt-4">
                  The standup is ongoing. The attendance is being marked by an admin.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // 4. Standup is Ended: Show who attended for both admins and users
    if (standup.status === "ended") {
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
                  Today's standup concluded at {standup.endedAt ? format(standup.endedAt.toDate(), 'p') : 'an unknown time'}. See who joined below.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mb-4">
                Checkmarks show who attended today's standup.
              </p>
              <div className="max-h-[300px] overflow-y-auto pr-2">
                <p className="text-lg font-semibold text-foreground mb-3">People</p>
                <ul className="space-y-3">
                  {employees.length > 0 ? (
                    employees.map((emp) => {
                      const present = savedAttendance[emp.id]?.status === "Present";
                      return (
                        <li
                          key={emp.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`attendance-view-${emp.id}`}
                              checked={present}
                              disabled // Always disabled in view mode
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
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              present ? "text-green-600" : "text-orange-600"
                            )}
                          >
                            {present ? "Present" : "Missed"}
                          </span>
                        </li>
                      );
                    })
                  ) : (
                    <p className="text-center text-muted-foreground">No employees found or attendance recorded.</p>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    return null; // Fallback
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}