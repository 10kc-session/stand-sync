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
  writeBatch,
  doc,
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
}
  from "@/components/ui/select";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils"; // Import cn for conditional classnames

// --- Type Definitions ---
type Employee = { id: string; name: string; email: string };
type Standup = { id: string; scheduled_at: Timestamp };
type Attendance = { employee_id: string; status: string | null };

export default function Attendance() {
  const { admin } = useAdminAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedAtt, setEditedAtt] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setEditing(false);
    try {
      const empSnapshot = await getDocs(collection(db, "employees"));
      const empData = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(empData);

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
        const standupData = { id: standupDoc.id, ...standupDoc.data() } as Standup;

        const attendanceQuery = query(collection(db, "attendance"), where("standup_id", "==", standupData.id));
        const attSnapshot = await getDocs(attendanceQuery);

        const map: Record<string, Attendance> = {};
        attSnapshot.forEach((doc) => {
          const attDoc = doc.data() as Attendance;
          map[attDoc.employee_id] = attDoc;
        });
        setAttendance(map);
        setEditedAtt({});
      } else {
        setAttendance({});
        setEditedAtt({});
      }
    } catch (error) {
      console.error("Failed to fetch attendance data:", error);
      toast({ title: "Error", description: "Could not fetch attendance data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = () => {
    const initial = Object.fromEntries(employees.map((emp) => [emp.id, attendance[emp.id]?.status || "Missed"]));
    setEditedAtt(initial);
    setEditing(true);
  };

  const handleChange = (empId: string, val: string) => {
    setEditedAtt((prev) => ({ ...prev, [empId]: val }));
  };

  const getTodaysStandup = async (): Promise<Standup | null> => {
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

    if (standupSnapshot.empty) {
      return null;
    }
    const standupDoc = standupSnapshot.docs[0];
    return { id: standupDoc.id, ...standupDoc.data() } as Standup;
  };

  const handleSave = async () => {
    setLoading(true);
    const standup = await getTodaysStandup();
    if (!standup) {
      toast({ title: "Error", description: "No standup scheduled for today.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const batch = writeBatch(db);
    employees.forEach((emp) => {
      const attendanceDocId = `${standup.id}_${emp.id}`;
      const attendanceDocRef = doc(db, "attendance", attendanceDocId);
      const dataToSet = {
        standup_id: standup.id,
        employee_id: emp.id,
        status: editedAtt[emp.id] || "Missed",
        scheduled_at: standup.scheduled_at
      };
      batch.set(attendanceDocRef, dataToSet, { merge: true });
    });

    try {
      await batch.commit();
      await fetchData();
      setEditing(false);
      toast({ title: "Success", description: "Attendance has been saved." });
    } catch (error) {
      console.error("Failed to save attendance:", error);
      toast({ title: "Error", description: "Failed to save attendance.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSheet = async () => {
    setLoading(true);
    const standup = await getTodaysStandup();
    if (!standup) {
      toast({ title: "No standup found for today.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const dataToSend = employees.map((emp) => ({
      standup_id: standup.id,
      standup_time: standup.scheduled_at.toDate().toLocaleString(),
      employee_id: emp.id,
      employee_name: emp.name,
      employee_email: emp.email,
      status: attendance[emp.id]?.status || "Missed",
    }));

    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbzaRO0VUstPMLRbDPNQEHhpbrChn37aNVhfhS6mt0SJ_QCQ-wK78Un-LwETZiI1PqWdjw/exec",
        {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: dataToSend }),
        }
      );
      toast({
        title: "Google Sheet sync completed!",
        description: "Data has been sent to the spreadsheet.",
      });
    } catch (error: unknown) {
      toast({
        title: "Google Sheet sync failed",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const totalEmployees = employees.length;
  const presentCount = employees.filter(
    (emp) => (editing ? editedAtt[emp.id] : attendance[emp.id]?.status) === "Present"
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          <Card className="p-6 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-3xl font-bold">Attendance</CardTitle>
              {admin && (
                <Button onClick={handleSyncSheet} disabled={loading} variant="outline">
                  Resync to Google Sheet
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-lg text-muted-foreground">Loading attendance...</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6 pt-2">
                    <div className="font-semibold text-lg text-foreground">
                      <span>Today's Attendance</span>
                      <span className="ml-4 text-green-700 font-extrabold">
                        Present: {presentCount} / {totalEmployees}
                      </span>
                    </div>

                    {admin && (
                      <>
                        {!editing ? (
                          <Button variant="secondary" size="sm" onClick={handleEdit}>Edit</Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditing(false);
                              setEditedAtt({});
                            }}>Cancel</Button>
                            <Button size="sm" onClick={handleSave}>Save</Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-secondary/80 z-10">
                        <TableRow>
                          <TableHead className="w-1/2">Name</TableHead>
                          <TableHead className="w-1/2">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                              No employees found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          employees.map((emp) => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">
                                {emp.name}
                              </TableCell>
                              <TableCell>
                                {editing && admin ? (
                                  <Select
                                    value={editedAtt[emp.id]}
                                    onValueChange={(value) => handleChange(emp.id, value)}
                                  >
                                    {/* Apply conditional styling to SelectTrigger based on selected value */}
                                    <SelectTrigger
                                      className={cn(
                                        "w-full md:w-[180px]",
                                        editedAtt[emp.id] === 'Present' ? 'text-green-600' : 'text-orange-600'
                                      )}
                                    >
                                      <SelectValue placeholder="Set status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Present">Present</SelectItem>
                                      <SelectItem value="Missed">Missed</SelectItem>
                                      <SelectItem value="Absent">Absent</SelectItem>
                                      <SelectItem value="Not Available">Not Available</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className={
                                    attendance[emp.id]?.status === 'Present'
                                      ? 'text-green-600 font-semibold'
                                      : 'text-orange-600 font-semibold'
                                  }>
                                    {attendance[emp.id]?.status || 'Missed'}
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