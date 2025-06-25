import React, { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useNavigate } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import "./AdminHome.css";

// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { Loader2 } from "lucide-react";

const AdminHome = () => {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<{
    standupTime: string | null;
    present: number;
  }>({ standupTime: null, present: 0 });

  const [employeeCount, setEmployeeCount] = useState<number>(0);
  // --- CHANGE 1: Add a loading state for this page's data ---
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!admin) navigate("/admin/login");
  }, [admin, navigate]);

  useEffect(() => {
    if (!admin) return;

    async function fetchSummaryAndEmployees() {
      // --- CHANGE 2: Set loading to true at the start of the fetch ---
      setIsLoading(true);
      try {
        const employeesCollection = collection(db, "employees");
        const snapshot = await getCountFromServer(employeesCollection);
        setEmployeeCount(snapshot.data().count);

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
          const standup = { id: standupDoc.id, ...standupDoc.data() } as { id: string, scheduled_at: Timestamp };

          const attendanceQuery = query(collection(db, "attendance"), where("standup_id", "==", standup.id));
          const attendanceSnapshot = await getDocs(attendanceQuery);

          const presentCount = attendanceSnapshot.docs.filter(
            (doc) => doc.data().status === "Present"
          ).length;

          const standupTime = standup.scheduled_at.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          setSummary({ standupTime, present: presentCount });
        } else {
          setSummary({ standupTime: null, present: 0 });
        }
      } catch (error) {
        console.error("Failed to fetch admin summary:", error);
        setSummary({ standupTime: null, present: 0 });
      } finally {
        // --- CHANGE 3: Set loading to false when the fetch is complete ---
        setIsLoading(false);
      }
    }

    fetchSummaryAndEmployees();
  }, [admin]);

  const handleScheduleStandup = () => {
    navigate("/standups");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        margin: 0,
      }}
    >
      <AppNavbar />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="card-style" style={{ maxWidth: 450 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <h1>Admin Dashboard</h1>
          </div>
          <div>
            <div
              className="banner"
              style={{
                marginBottom: 32,
                marginTop: 0,
                background: "linear-gradient(90deg,#d4eeff 0%,#cbeeec 80%)",
              }}
            >
              Welcome,{" "}
              <span style={{ color: "#088", fontWeight: 800 }}>
                {admin?.email}!
              </span>
            </div>

            {/* --- CHANGE 4: Add a loading indicator check here --- */}
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading summary...</span>
              </div>
            ) : summary.standupTime ? (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: "1.08rem",
                    color: "#185b7e",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    fontWeight: 600,
                  }}
                >
                  <div>
                    <span>Today's Standup:</span>
                    <span
                      style={{
                        marginLeft: 11,
                        color: "#117ddb",
                        fontSize: "1.21rem",
                        fontWeight: "bold",
                      }}
                    >
                      {summary.standupTime}
                    </span>
                  </div>
                  <div>
                    <span>Attendance:</span>
                    <span
                      style={{
                        marginLeft: 9,
                        color: "#18ad7c",
                        fontWeight: "bold",
                        fontSize: "1.19rem",
                      }}
                    >
                      {summary.present} / {employeeCount}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className="banner"
                  style={{
                    color: "#b85c42",
                    background:
                      "linear-gradient(90deg,#ffece6 0%, #f4e6e6 100%)",
                    marginTop: 20,
                    fontWeight: 600,
                    fontSize: "1.07rem",
                  }}
                >
                  No standup scheduled today.
                </div>
                <Button
                  size="lg"
                  className="w-full mt-6 font-bold"
                  onClick={handleScheduleStandup}
                  data-testid="admin-schedule-standup-home-btn"
                >
                  Schedule Standup
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;