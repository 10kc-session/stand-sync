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
import AppNavbar from "@/components/AppNavbar";
import AdminScheduleStandup from "@/components/AdminScheduleStandup";
import "./Attendance.css";

// --- Type Definitions for Firestore ---
type Employee = { id: string; name: string; email: string };
type Standup = { id: string; scheduled_at: Timestamp };
type Attendance = { employee_id: string; status: string | null, standup_id: string };

export default function Standups() {
  // --- CHANGE 1: Add a new loading state for the initial page load ---
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [standup, setStandup] = useState<Standup | null>(null);
  const [standupCompleted, setStandupCompleted] = useState(false);
  const [standupStarted, setStandupStarted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedAttendance, setEditedAttendance] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    // --- CHANGE 2: Ensure loading state is true at the start ---
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

        setStandupCompleted(attSnapshot.size === empData.length && attSnapshot.size > 0);
      } else {
        setStandup(null);
        setAttendance({});
        setStandupCompleted(false);
      }
    } catch (error) {
      console.error("Failed to fetch standup data:", error);
      // Handle error state if needed
    } finally {
      // --- CHANGE 3: Set loading to false after all data fetching is done ---
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
    setEditedAttendance(
      Object.fromEntries(
        employees.map(emp => [emp.id, attendance[emp.id]?.status === "Present"])
      )
    );
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

    await batch.commit();

    await fetchData();
    setStandupStarted(false);
    setEditing(false);
    setStandupCompleted(true);
  };

  const renderContent = () => {
    // --- CHANGE 4: Main rendering logic is now wrapped in a loading check ---
    if (isLoadingPage) {
      return (
        <div className="text-center text-lg font-semibold text-muted-foreground p-10">
          Loading...
        </div>
      );
    }

    // 1. No standup for today: Show ONLY schedule section
    if (!standup) {
      return <AdminScheduleStandup onAfterSchedule={handleScheduleReload} />;
    }

    // 2. Standup scheduled for today
    if (standup && !standupStarted && !standupCompleted) {
      return (
        <div className="card-style" style={{ maxWidth: 520, margin: "40px auto 0", textAlign: "center", padding: 32 }}>
          <h2 style={{ marginBottom: 18 }}>Today's Standup</h2>
          <div className="banner" style={{ background: "#e6f7ff", color: "#096", margin: "0 0 20px 0" }}>
            Standup scheduled for today.
          </div>
          <button
            className="btn-style py-2 px-7 text-lg rounded"
            onClick={handleStartStandup}
          >
            Start Standup
          </button>
        </div>
      );
    }

    // 3. Standup started: Show attendance editing using checkboxes
    if (standup && standupStarted && !standupCompleted) {
      return (
        <div className="card-style" style={{ maxWidth: 520, margin: "40px auto 0" }}>
          <h2 style={{ marginBottom: 16 }}>Mark Attendance</h2>
          <div style={{ marginTop: 12, fontWeight: 600, color: "#267", marginBottom: 12 }}>People</div>
          <ul style={{ paddingLeft: 0, margin: 0 }}>
            {employees.map(emp => (
              <li
                key={emp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 12,
                  fontWeight: 500,
                  color: editedAttendance[emp.id] ? "#20af6e" : "#cb9620",
                  fontSize: "1.025rem"
                }}
              >
                <input
                  type="checkbox"
                  checked={!!editedAttendance[emp.id]}
                  onChange={e => handleAttendanceCheck(emp.id, e.target.checked)}
                  disabled={!editing}
                  style={{
                    marginRight: 12,
                    accentColor: "#20af6e",
                    width: "20px",
                    height: "20px",
                    cursor: editing ? "pointer" : "default"
                  }}
                />
                <span>{emp.name}</span>
              </li>
            ))}
          </ul>
          <button
            className="btn-style"
            style={{ marginTop: 30, background: "#18ae7a", color: "white", fontWeight: 700, fontSize: "1rem", padding: "10px 26px", borderRadius: 11 }}
            onClick={handleStopStandup}
          >
            Stop
          </button>
        </div>
      );
    }

    // 4. Standup completed: Show who attended (checkbox, disabled)
    if (standup && standupCompleted) {
      return (
        <div className="card-style" style={{ maxWidth: 520, margin: "30px auto 0" }}>
          <h1 style={{ marginBottom: 13 }}>Team Standups</h1>
          <div className="banner" style={{ color: "#088", marginTop: 0, background: "linear-gradient(90deg,#eefff9 0%,#e8f5fa 80%)" }}>
            Standup completed for today!
          </div>
          <div style={{ marginTop: 18, color: "#238", fontWeight: 400, fontSize: "1.04rem" }}>
            See who joined today's standup and stay connected. Checkmarks show who attended.
          </div>
          <div style={{ marginTop: 30 }}>
            <div style={{ fontWeight: 600, color: "#267", marginBottom: 10, fontSize: "1.08rem" }}>People</div>
            <div>
              <ul style={{ paddingLeft: 0, margin: 0 }}>
                {employees.map(emp => {
                  const present = attendance[emp.id]?.status === "Present";
                  return (
                    <li
                      key={emp.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: 9,
                        fontWeight: 500,
                        color: present ? "#20af6e" : "#cb9620",
                        fontSize: "1.025rem"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={present}
                        readOnly
                        disabled
                        style={{
                          marginRight: 12,
                          accentColor: present ? "#11b26b" : "#beae6c",
                          width: "18px",
                          height: "18px",
                          cursor: "default"
                        }}
                      />
                      <span>{emp.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="banner" style={{ background: "#e5ffe5", color: "#159f46", marginTop: 16 }}>
              Standup completed!
            </div>
          </div>
        </div>
      );
    }

    // Fallback case, though it should ideally not be reached
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(120deg, #e6eafc 0%, #c8eafc 50%, #f1f4f9 100%)" }}>
      <AppNavbar />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 620 }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}