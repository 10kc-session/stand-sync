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
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      const empData = empSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Employee, "id">),
      }));
      setEmployees(empData);

      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const todaysId = todayUTC.toISOString().split("T")[0];

      const standupRef = doc(db, "standups", todaysId);
      const standupSnap = await getDoc(standupRef);

      if (standupSnap.exists()) {
        const standupDoc = { id: standupSnap.id, ...(standupSnap.data() as Omit<Standup, "id">) };
        const attSnapshot = await getDocs(
          query(
            collection(db, "attendance"),
            where("standup_id", "==", standupDoc.id)
          )
        );
        const map: Record<string, Attendance> = {};
        attSnapshot.forEach(d => {
          const a = d.data() as Attendance;
          map[a.employee_id] = a;
        });
        setAttendance(map);
      } else {
        setAttendance({});
      }

      setEditedAtt({});
    } catch (error) {
      console.error("Failed to fetch attendance data:", error);
      toast({
        title: "Error",
        description: "Could not fetch attendance data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = () => {
    const initial = Object.fromEntries(
      employees.map(emp => [
        emp.id,
        attendance[emp.id]?.status || "Missed",
      ])
    );
    setEditedAtt(initial);
    setEditing(true);
  };

  const handleChange = (empId: string, val: string) => {
    setEditedAtt(prev => ({ ...prev, [empId]: val }));
  };

  // MODIFIED: Now handles cases where an existing standup document is missing the scheduled_at field.
  const getOrCreateTodaysStandup = async (): Promise<Standup> => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todaysId = todayUTC.toISOString().split("T")[0];

    const standupRef = doc(db, "standups", todaysId);
    const standupSnap = await getDoc(standupRef);
    const tsNow = Timestamp.now();

    // If the document exists, check its content
    if (standupSnap.exists()) {
      const data = standupSnap.data();
      // If the crucial 'scheduled_at' field is missing, update the document
      if (!data.scheduled_at) {
        await setDoc(standupRef, { scheduled_at: tsNow }, { merge: true });
        return { id: standupSnap.id, scheduled_at: tsNow };
      }
      // Otherwise, return the existing data
      return { id: standupSnap.id, ...(data as Omit<Standup, "id">) };
    }

    // If the document doesn't exist, create it with the timestamp
    await setDoc(standupRef, { scheduled_at: tsNow });
    return { id: todaysId, scheduled_at: tsNow };
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const standup = await getOrCreateTodaysStandup();
      const markedAtTimestamp = Timestamp.now();

      const batch = writeBatch(db);
      employees.forEach(emp => {
        const ref = doc(db, "attendance", `${standup.id}_${emp.id}`);
        batch.set(
          ref,
          {
            standup_id: standup.id,
            employee_id: emp.id,
            status: editedAtt[emp.id] || "Missed",
            scheduled_at: standup.scheduled_at,
            markedAt: markedAtTimestamp,
          },
          { merge: true }
        );
      });
      await batch.commit();

      await fetchData();
      setEditing(false);
      toast({ title: "Success", description: "Attendance saved." });
    } catch (error) {
      console.error("Failed to save attendance:", error);
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
      const standup = await getOrCreateTodaysStandup();
      const dataToSend = employees.map(emp => ({
        standup_id: standup.id,
        standup_time: standup.scheduled_at.toDate().toLocaleString(),
        employee_id: emp.id,
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
          body: JSON.stringify({ records: dataToSend }),
        }
      );
      toast({
        title: "Sync complete",
        description: "Sent to Google Sheet.",
      });
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
  const presentCount = employees.filter(
    emp => (editing ? editedAtt[emp.id] : attendance[emp.id]?.status) === "Present"
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
            <CardHeader className="flex flex-row justify-between items-start pb-4">
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
                  <span className="ml-3 text-lg text-muted-foreground">
                    Loading attendance...
                  </span>
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
                    {admin &&
                      (editing ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(false);
                              setEditedAtt({});
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSave}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={handleEdit}>
                          Edit
                        </Button>
                      ))}
                  </div>
                  <div className="overflow-auto rounded-md border max-h-[60vh]">
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
                          employees.map(emp => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">{emp.name}</TableCell>
                              <TableCell>
                                {editing && admin ? (
                                  <Select
                                    value={editedAtt[emp.id]}
                                    onValueChange={val => handleChange(emp.id, val)}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "w-full md:w-[180px]",
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
                                      <SelectItem value="Not Available">Not Available</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span
                                    className={
                                      attendance[emp.id]?.status === "Present"
                                        ? "text-green-600 font-semibold"
                                        : "text-orange-600 font-semibold"
                                    }
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