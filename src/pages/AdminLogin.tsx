// src/pages/AdminLogin.tsx

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/context/AdminAuthContext";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";

const AdminLogin: React.FC = () => {
  const { admin, loading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait until we know whether someone is signed in and is an admin
    if (adminLoading) return;

    // If they are already signed in as admin, send them to /admin
    if (admin) {
      navigate("/admin", { replace: true });
    }
  }, [admin, adminLoading, navigate]);

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
