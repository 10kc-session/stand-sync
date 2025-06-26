import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";

type Props = {
  attendanceStreak: number | "N/A" | null;
  attendanceLoading: boolean;
  isAdmin: boolean;
};

const HomeStreakBanner: React.FC<Props> = ({ attendanceStreak, attendanceLoading }) => {

  const renderContent = () => {
    if (attendanceLoading) {
      return <div className="h-10 w-24 bg-secondary rounded-md animate-pulse" />;
    }

    if (attendanceStreak === null || attendanceStreak === 0) {
      return (
        <div className="text-center">
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm text-muted-foreground mt-1">Join a standup to start your streak!</p>
        </div>
      );
    }

    return (
      <div className="text-center">
        <p className="text-5xl font-extrabold text-primary">{attendanceStreak}</p>
        <p className="text-sm font-medium text-muted-foreground mt-1">
          day{attendanceStreak === 1 ? "" : "s"}
        </p>
      </div>
    )
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Attendance Streak</CardTitle>
        <Flame className="h-5 w-5 text-orange-500" />
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default HomeStreakBanner;
