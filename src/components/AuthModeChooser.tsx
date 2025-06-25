
import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onChoose: (mode: "TeamMember" | "Admin") => void;
};

const AuthModeChooser: React.FC<Props> = ({ onChoose }) => (
  <div className="space-y-6 text-center">
    <h1 className="text-3xl font-bold mb-4">Welcome to Your Attendance Tracker</h1>
    <div className="space-y-2">
      <Button className="w-full h-12 text-lg" onClick={() => onChoose("TeamMember")}>Team Member</Button>
      <Button className="w-full h-12 text-lg" variant="outline" onClick={() => onChoose("Admin")}>Admin</Button>
    </div>
  </div>
);

export default AuthModeChooser;
