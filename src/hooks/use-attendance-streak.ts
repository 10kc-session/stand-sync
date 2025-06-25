import { useState, useEffect } from "react";
// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { useUserAuth } from "@/context/UserAuthContext"; // Use our Firebase Auth hook
import { useAdminAuth } from "@/context/AdminAuthContext";

type AttendanceStreak = number | "N/A" | null;

export function useAttendanceStreak() {
  const { user } = useUserAuth(); // Use Firebase user
  const { admin } = useAdminAuth(); // Admin context remains the same
  const [attendanceStreak, setAttendanceStreak] = useState<AttendanceStreak>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    async function fetchStreak() {
      if (!user) { // Check only for the firebase user
        setAttendanceStreak(null);
        return;
      }
      setAttendanceLoading(true);

      // --- REWRITTEN Firestore Query ---
      // Query the 'attendance' collection directly.
      // Filter by the logged-in user's ID.
      // Order by the denormalized 'scheduled_at' date.
      const attendanceCollection = collection(db, "attendance");
      const q = query(
        attendanceCollection,
        where("employee_id", "==", user.uid), // Use user.uid for Firebase
        orderBy("scheduled_at", "desc")
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAttendanceStreak(0); // No records, so streak is 0
        setAttendanceLoading(false);
        return;
      }

      // --- Simplified Streak Calculation Logic ---
      // The data from Firestore is already sorted correctly.
      const sortedAtt = querySnapshot.docs.map(doc => doc.data());

      let streak = 0;
      for (let i = 0; i < sortedAtt.length; i++) {
        if (sortedAtt[i].status === "Present") {
          // If it's the most recent record, the streak is at least 1
          if (i === 0) {
            streak = 1;
          } else {
            // Compare the date with the previous record in the sorted list
            const prevDate = (sortedAtt[i - 1].scheduled_at as Timestamp).toDate();
            const currDate = (sortedAtt[i].scheduled_at as Timestamp).toDate();

            // Set hours to 0 to compare dates only
            prevDate.setHours(0, 0, 0, 0);
            currDate.setHours(0, 0, 0, 0);

            const diff = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

            // If the difference is exactly 1 day, it's a consecutive day
            if (diff === 1) {
              streak += 1;
            } else {
              // If there's a gap, the streak is broken
              break;
            }
          }
        } else {
          // If the most recent entry is not "Present", the streak is 0.
          // If any other entry is not "Present", the streak is broken.
          streak = 0;
          break;
        }
      }

      setAttendanceStreak(streak);
      setAttendanceLoading(false);
    }

    // Logic to decide when to run the fetch (simplified)
    if (user) { // If there's a regular user, fetch their streak
      fetchStreak();
    } else if (admin) { // If it's an admin, show N/A
      setAttendanceStreak("N/A");
    } else { // If no one is logged in, do nothing
      setAttendanceStreak(null);
    }
  }, [user, admin]);

  return { attendanceStreak, attendanceLoading };
}