import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/context/AdminAuthContext";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";

const AdminLogin = () => {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();

  // If a user who is already an admin lands on this page, redirect them to the dashboard.
  useEffect(() => {
    if (admin) {
      navigate("/admin");
    }
  }, [admin, navigate]);

  // This page no longer needs state for email, password, or a submit handler.
  // Its only job is to provide information and a link.

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
              <Link to="/auth">Go to Sign-In Page</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;