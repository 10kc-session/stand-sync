/**
 * A card component for admin authentication, including email and password fields,
 * error display, loading state, and navigation controls.
 *
 * @component
 * @param {string} adminEmail - The current value of the admin email input.
 * @param {(v: string) => void} setAdminEmail - Callback to update the admin email value.
 * @param {string} adminPassword - The current value of the admin password input.
 * @param {(v: string) => void} setAdminPassword - Callback to update the admin password value.
 * @param {string | null} adminError - Error message to display, or null if no error.
 * @param {boolean} loading - Whether the form is in a loading/submitting state.
 * @param {(e: React.FormEvent) => void} onSubmit - Handler for form submission.
 * @param {() => void} onBack - Handler for the "Back" button click.
 *
 * @returns {JSX.Element} The rendered admin authentication card.
 */
import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

type Props = {
  adminEmail: string;
  setAdminEmail: (v: string) => void;
  adminPassword: string;
  setAdminPassword: (v: string) => void;
  adminError: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
};

const AdminAuthCard: React.FC<Props> = ({
  adminEmail,
  setAdminEmail,
  adminPassword,
  setAdminPassword,
  adminError,
  loading,
  onSubmit,
  onBack,
}) => (
  <Card className="max-w-sm mx-auto">
    <CardHeader>
      <CardTitle>Admin Login</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-6">
        {adminError && (
          <Alert variant="destructive">
            <AlertTitle>{adminError}</AlertTitle>
          </Alert>
        )}

        <div>
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="you@company.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Signing in..." : "Login"}
        </Button>

        <div className="flex justify-end">
          <Button variant="link" onClick={onBack} disabled={loading}>
            Back
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
);

export default AdminAuthCard;
