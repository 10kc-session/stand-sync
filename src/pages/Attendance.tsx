/**
 * Attendance page component for managing and viewing employee attendance records.
 *
 * - Fetches employee and attendance data from Firestore.
 * - Allows admins to edit and save attendance for a selected date.
 * - Supports syncing attendance data to a Google Sheet via an external API.
 * - Displays attendance status for each employee and provides summary statistics.
 * - Integrates with custom UI components and context for authentication and notifications.
 *
 * @component
 * @returns {JSX.Element} The rendered Attendance management page.
 *
 * @remarks
 * - Only admins can edit or sync attendance.
 * - Attendance is tied to a specific standup date (one per day).
 * - Uses Firestore batch writes for efficient updates.
 */
import React, { useEffect, useState, useCallback } from "react";
// --- Firebase Imports ---

import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  writeBatch,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

// --- Component Imports ---
import AppNavbar from "@/components/AppNavbar";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// --- Type Definitions ---
type Employee = { id: string; name: string; email: string; employeeId: string };
// Updated to use the correct field name
type Standup = { id: string; scheduledTime: Timestamp };
type Attendance = { employee_id: string; status: string | null };

export default function Attendance() {
  const { admin } = useAdminAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedAtt, setEditedAtt] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const fetchData = useCallback(
    async (date: Date) => {
      setLoading(true);
      setEditing(false);
      try {
        // Load employee list once
        if (employees.length === 0) {
          const empSnap = await getDocs(collection(db, "employees"));
          setEmployees(
            empSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Employee, "id">),
            }))
          );
        }

        // Build today's standup ID
        const standupId = format(date, "yyyy-MM-dd");
        const standupRef = doc(db, "standups", standupId);
        const standupSnap = await getDoc(standupRef);

        if (standupSnap.exists()) {
          // Pull in the correct field
          const standupDoc = {
            id: standupSnap.id,
            ...(standupSnap.data() as Omit<Standup, "id">),
          };
          const attSnap = await getDocs(
            query(
              collection(db, "attendance"),
              where("standup_id", "==", standupDoc.id)
            )
          );
          const map: Record<string, Attendance> = {};
          attSnap.forEach((d) => {
            const a = d.data() as Attendance;
            map[a.employee_id] = a;
          });
          setAttendance(map);
        } else {
          setAttendance({});
        }

        setEditedAtt({});
      } catch (err) {
        console.error("Failed to fetch attendance data:", err);
        toast({
          title: "Error",
          description: "Could not fetch attendance data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [employees.length, toast]
  );

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  const handleEdit = () => {
    setEditedAtt(
      Object.fromEntries(
        employees.map((emp) => [
          emp.id,
          attendance[emp.id]?.status || "Missed",
        ])
      )
    );
    setEditing(true);
  };

  const handleChange = (empId: string, val: string) => {
    setEditedAtt((prev) => ({ ...prev, [empId]: val }));
  };

  const getOrCreateStandupForDate = async (date: Date): Promise<Standup> => {
    const standupId = format(date, "yyyy-MM-dd");
    const standupRef = doc(db, "standups", standupId);
    const standupSnap = await getDoc(standupRef);
    const now = Timestamp.now();

    if (standupSnap.exists()) {
      const data = standupSnap.data();
      // If the document exists but missing the field, patch it
      if (!("scheduledTime" in data)) {
        await setDoc(standupRef, { scheduledTime: now }, { merge: true });
        return { id: standupSnap.id, scheduledTime: now };
      }
      return {
        id: standupSnap.id,
        ...(data as Omit<Standup, "id">),
      };
    }

    // Otherwise create fresh
    await setDoc(standupRef, { scheduledTime: now });
    return { id: standupId, scheduledTime: now };
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const standup = await getOrCreateStandupForDate(selectedDate);
      const markedAt = Timestamp.now();
      const batch = writeBatch(db);

      employees.forEach((emp) => {
        const ref = doc(db, "attendance", `${standup.id}_${emp.id}`);
        batch.set(
          ref,
          {
            standup_id: standup.id,
            employee_id: emp.id,
            status: editedAtt[emp.id] || "Missed",
            // write back to the correct field
            scheduledTime: standup.scheduledTime,
            markedAt,
          },
          { merge: true }
        );
      });

      await batch.commit();
      await fetchData(selectedDate);
      setEditing(false);
      toast({ title: "Success", description: "Attendance saved." });
    } catch (err) {
      console.error("Failed to save attendance:", err);
      toast({
        title: "Error",
        description: "Could not save attendance.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSheet = async () => {
    setLoading(true);
    try {
      const standup = await getOrCreateStandupForDate(selectedDate);
      const payload = employees.map((emp) => ({
        standup_id: standup.id,
        standup_time: standup.scheduledTime.toDate().toLocaleString(),
        employee_id: emp.employeeId,
        employee_name: emp.name,
        employee_email: emp.email,
        status: attendance[emp.id]?.status || "Missed",
      }));
      await fetch(
        "https://script.google.com/macros/s/AKfycbzaRO0VUstPMLRbDPNQEHhpbrChn37aNVhfhS6mt0SJ_QCQ-wK78Un-LwETZiI1PqWdjw/exec",
        {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: payload }),
        }
      );
      toast({ title: "Sync complete", description: "Sent to Google Sheet." });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalEmployees = employees.length;
  const presentCount = employees.filter((emp) =>
    (editing ? editedAtt[emp.id] : attendance[emp.id]?.status) === "Present"
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex items-center justify-center p-3 md:p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          <Card className="p-4 md:p-6 shadow-lg">
            <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 md:pb-4 gap-3 md:gap-0">
              <CardTitle className="text-2xl md:text-3xl font-bold">
                Attendance
              </CardTitle>
              {admin && (
                <Button
                  onClick={handleSyncSheet}
                  disabled={loading}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  Resync to Google Sheet
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center p-6 md:p-8">
                  <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
                  <span className="ml-2 md:ml-3 text-base md:text-lg text-muted-foreground">
                    Loading attendance...
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 pt-2 gap-4 md:gap-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full md:w-auto">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full sm:w-[280px] justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate
                              ? format(selectedDate, "PPP")
                              : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="font-semibold text-base md:text-lg text-foreground">
                        <span className="text-green-700 font-extrabold">
                          Present: {presentCount} / {totalEmployees}
                        </span>
                      </div>
                    </div>
                    {admin &&
                      (editing ? (
                        <div className="flex gap-2 w-full md:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(false);
                              setEditedAtt({});
                            }}
                            className="flex-1 md:flex-none"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            className="flex-1 md:flex-none"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleEdit}
                          className="w-full md:w-auto"
                        >
                          Edit
                        </Button>
                      ))}
                  </div>
                  <div className="overflow-auto rounded-md border max-h-[50vh] md:max-h-[60vh]">
                    <Table className="min-w-[500px] md:min-w-0">
                      <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                        <TableRow>
                          <TableHead className="w-1/2 text-sm md:text-base">
                            Name
                          </TableHead>
                          <TableHead className="w-1/2 text-sm md:text-base">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={2}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No employees found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          employees.map((emp) => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium text-sm md:text-base">
                                {emp.name}
                              </TableCell>
                              <TableCell>
                                {editing && admin ? (
                                  <Select
                                    value={editedAtt[emp.id]}
                                    onValueChange={(v) => handleChange(emp.id, v)}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "w-full text-xs md:text-sm",
                                        editedAtt[emp.id] === "Present"
                                          ? "text-green-600"
                                          : "text-orange-600"
                                      )}
                                    >
                                      <SelectValue placeholder="Set status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Present">Present</SelectItem>
                                      <SelectItem value="Missed">Missed</SelectItem>
                                      <SelectItem value="Absent">Absent</SelectItem>
                                      <SelectItem value="Not Available">
                                        Not Available
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span
                                    className={cn(
                                      "text-xs md:text-sm",
                                      attendance[emp.id]?.status === "Present"
                                        ? "text-green-600 font-semibold"
                                        : "text-orange-600 font-semibold"
                                    )}
                                  >
                                    {attendance[emp.id]?.status || "Missed"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
