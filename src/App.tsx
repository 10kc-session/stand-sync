// src/App.tsx

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { UserAuthProvider, useUserAuth } from "./context/UserAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AdminLogin from "./pages/AdminLogin";
import Index from "./pages/Index";
import EmployeeSetup from "./pages/EmployeeSetup";
import Standups from "./pages/Standups";
import Attendance from "./pages/Attendance";
import AdminHome from "./pages/AdminHome";
import AdminEmployees from "./pages/AdminEmployees";
import AdminEmployeeDetail from "./pages/AdminEmployeeDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Global loading spinner while auth contexts initialize
const GlobalLoading = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary border-solid"></div>
    <p className="mt-4 text-lg text-muted-foreground">Verifying session...</p>
  </div>
);

const AppContent = () => {
  const { user, loading: userLoading, initialized: userInitialized } = useUserAuth();
  const { admin, loading: adminLoading, initialized: adminInitialized } = useAdminAuth();

  // Wait until both contexts finish their initial checks
  if (!userInitialized || !adminInitialized) {
    return <GlobalLoading />;
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Root: landing or dashboard or admin */}
      <Route
        path="/"
        element={
          !user ? (
            <LandingPage />
          ) : admin ? (
            <Navigate to="/admin" replace />
          ) : (
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          )
        }
      />

      {/* Explicit index, same logic as "/" */}
      <Route
        path="/index"
        element={
          admin ? (
            <Navigate to="/admin" replace />
          ) : (
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          )
        }
      />

      {/* Employee-only */}
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <EmployeeSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/standups"
        element={
          <ProtectedRoute>
            <Standups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />

      {/* Admin-only */}
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminHome />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <AdminProtectedRoute>
            <AdminEmployees />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/employees/:employeeId"
        element={
          <AdminProtectedRoute>
            <AdminEmployeeDetail />
          </AdminProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserAuthProvider>
          <AdminAuthProvider>
            <AppContent />
          </AdminAuthProvider>
        </UserAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
