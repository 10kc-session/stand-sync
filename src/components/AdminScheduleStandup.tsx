import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";

// --- Type Definition for Firestore ---
type Standup = {
  id: string;
  scheduled_at: Timestamp;
  created_at: Timestamp;
};

type AdminScheduleStandupProps = {
  onAfterSchedule?: () => void;
};

export default function AdminScheduleStandup({ onAfterSchedule }: AdminScheduleStandupProps) {
  const [time, setTime] = useState("");
  const [standups, setStandups] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUserAuth();
  const { admin } = useAdminAuth();
  const { toast } = useToast();

  const fetchStandups = async () => {
    setLoading(true);
    try {
      const standupsCollection = collection(db, "standups");
      const q = query(standupsCollection, orderBy("scheduled_at", "asc"));
      const querySnapshot = await getDocs(q);
      const standupData = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Standup)
      );
      setStandups(standupData);
    } catch (error: any) {
      toast({
        title: "Error loading standups",
        description: error.message,
        variant: "destructive",
      });
      console.error("Error fetching standups:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStandups();
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user && !admin) {
      toast({ title: "Not logged in", variant: "destructive" });
      return;
    }
    if (!time) {
      toast({ title: "Please select a time", variant: "destructive" });
      return;
    }
    setLoading(true);

    const today = new Date();
    const [hours, minutes] = time.split(":").map(Number);
    today.setHours(hours, minutes, 0, 0);

    const insertObj: any = {
      scheduled_at: Timestamp.fromDate(today),
      created_at: serverTimestamp(),
    };

    // --- THIS IS THE CORRECTED LINE ---
    const creatorId = user ? user.uid : admin ? admin.email : null;
    if (creatorId) {
      insertObj.created_by = creatorId;
    }

    try {
      await addDoc(collection(db, "standups"), insertObj);
      toast({ title: "Standup Scheduled" });
      setTime("");
      await fetchStandups();
      if (onAfterSchedule) onAfterSchedule();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      console.error("Insert error:", error);
    }
    setLoading(false);
  };

  const setToNowTime = () => {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    setTime(`${hour}:${minute}`);
  };

  return (
    <Card className="w-full mt-6 md:max-w-lg">
      <CardHeader>
        <CardTitle>Schedule Standup</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSchedule} className="flex gap-2 items-center mb-4">
          <div>
            <span>Today at:</span>
            <Input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
              className="ml-2 w-28"
              min="06:00"
              max="23:00"
              data-testid="schedule-time-input"
            />
            <Button type="button" size="sm" className="ml-2" variant="ghost" onClick={setToNowTime} data-testid="now-btn">
              Now
            </Button>
          </div>
          <Button type="submit" disabled={loading} data-testid="add-btn">Add</Button>
        </form>

        <h4 className="font-semibold mb-2">All Scheduled Standups:</h4>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ul className="space-y-2">
            {standups.map(su => (
              <li key={su.id} className="flex justify-between border-b py-2">
                <span>
                  {su.scheduled_at.toDate().toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {su.created_at?.toDate().toLocaleDateString()}
                </span>
              </li>
            ))}
            {standups.length === 0 && <li className="text-muted-foreground">No standups scheduled.</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}