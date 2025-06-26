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
} from "@/components/ui/select";
import "./Attendance.css";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Loader2 } from "lucide-react";

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

    await batch.commit();
    await fetchData();
    setEditing(false);
    toast({ title: "Success", description: "Attendance has been saved." });
    setLoading(false);
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
      // --- THIS URL HAS BEEN UPDATED ---
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppNavbar />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div className="card-style w-full" style={{ maxWidth: 700 }}>
          <h1 style={{ marginBottom: 18 }}>Attendance</h1>

          {admin && (
            <Button onClick={handleSyncSheet} disabled={loading}>
              Resync to Google Sheet
            </Button>
          )}

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            <>
              <div style={{ margin: "18px 0 7px 0", fontWeight: 600, color: "#27588a", fontSize: "1.05rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span>Today's Attendance</span>
                  <span style={{ marginLeft: 20, color: "#188d4c", fontWeight: 800 }}>
                    Present: {presentCount} / {totalEmployees}
                  </span>
                </div>

                {admin && (
                  <>
                    {!editing ? (
                      <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave}>Save</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ overflowX: "auto", width: "100%", marginTop: 10 }}>
                <Table className="table-style">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id} className={
                        editing
                          ? (editedAtt[emp.id] === 'Present' ? 'table-row-present' : 'table-row-missed')
                          : (attendance[emp.id]?.status === 'Present' ? 'table-row-present' : 'table-row-missed')}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell>
                          {editing && admin ? (
                            <Select value={editedAtt[emp.id]} onValueChange={(value) => handleChange(emp.id, value)}>
                              <SelectTrigger className="w-[180px]">
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
                            attendance[emp.id]?.status || <span style={{ color: "#be8808" }}>Missed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
