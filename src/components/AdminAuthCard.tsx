
import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  adminEmail: string;
  setAdminEmail: (v: string) => void;
  adminPassword: string;
  setAdminPassword: (v: string) => void;
  adminError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
};

const AdminAuthCard: React.FC<Props> = ({
  adminEmail, setAdminEmail,
  adminPassword, setAdminPassword,
  adminError, onSubmit, onBack
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Admin Login</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit}>
        <div className="space-y-4">
          <Input
            type="text"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            placeholder="Admin username"
            required
          />
          <Input
            type="password"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Password"
            required
          />
          {adminError && <div className="text-sm text-red-500">{adminError}</div>}
          <Button type="submit" className="w-full mt-2">Login</Button>
          <div className="flex justify-end pt-2">
            <button type="button" className="underline text-sm" onClick={onBack}>Back</button>
          </div>
        </div>
      </form>
    </CardContent>
  </Card>
);

export default AdminAuthCard;
