/**
 * AdminLogin component handles the admin login flow.
 *
 * - Redirects authenticated admins to the admin dashboard.
 * - Shows a loading spinner while authentication state is being determined.
 * - Presents a card with instructions and a button to navigate to the main sign-in page for unauthenticated users.
 *
 * Uses:
 * - `useAdminAuth` context to access admin authentication state and loading status.
 * - `useNavigate` from react-router-dom for navigation.
 * - UI components from the local project and Lucide React for the loading spinner.
 */
// src/pages/AdminLogin.tsx

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/context/AdminAuthContext";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";   // changes


const AdminLogin: React.FC = () => {
  const { admin, loading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminLoading) return;
    if (admin) navigate("/admin", { replace: true });
  }, [admin, adminLoading, navigate]);

  // ← ADD THIS:
  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-muted-foreground">
              To access the admin dashboard, please sign in with an authorized
              admin account using the main authentication page.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link to="/auth" replace>
                Go to Sign-In Page
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
