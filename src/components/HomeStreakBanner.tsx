
import React from "react";

type Props = {
  attendanceStreak: number | "N/A" | null;
  attendanceLoading: boolean;
  isAdmin: boolean;
};

const HomeStreakBanner: React.FC<Props> = ({ attendanceStreak, attendanceLoading, isAdmin }) => (
  <div className="mb-6">
    <div className="text-lg font-semibold text-center flex flex-col gap-1">
      <span>Your Attendance Streak:</span>
      <span className="text-3xl font-bold text-primary">
        {attendanceLoading ? (
          "Loading..."
        ) : (
          isAdmin || attendanceStreak === "N/A" ? (
            "N/A"
          ) : attendanceStreak === null || attendanceStreak === 0 ? (
            <>
              <span className="block text-base font-medium text-muted-foreground mt-1">
                No attendance streak yet? <br />
                <span className="text-primary font-bold">Every habit starts with a single step!</span><br />
                Join your first standup today.
              </span>
            </>
          ) : (
            <>
              {attendanceStreak}
              <span className="text-base font-medium ml-1">
                day{attendanceStreak === 1 ? "" : "s"}
              </span>
            </>
          )
        )}
      </span>
    </div>
  </div>
);

export default HomeStreakBanner;
