/**
 * The main application component for Standup Sync.
 *
 * - Provides global context providers for React Query, tooltips, user and admin authentication.
 * - Handles global loading state while authentication contexts initialize.
 * - Sets up all application routes, including:
 *   - Public routes (auth, admin login)
 *   - Employee-protected routes (dashboard, setup, standups, attendance)
 *   - Admin-protected routes (admin dashboard, employee management)
 *   - Fallback for 404 Not Found
 * - Uses custom `ProtectedRoute` and `AdminProtectedRoute` components to guard sensitive routes.
 * - Integrates two different toaster notification systems (`Toaster` and `Sonner`).
 *
 * @component
 */
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
    <div className="relative">
      <div className="absolute inset-0 blur-xl opacity-20 rounded-full animate-pulse-slow h-24 w-24"></div>
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-[3px] border-muted animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-[3px] border-primary border-t-transparent animate-spin-slow"></div>
      </div>
    </div>
    <div className="mt-6 space-y-2">
      <p className="text-lg text-muted-foreground font-medium animate-text-fade">
        Verifying session
      </p>
      <div className="flex justify-center">
        <div className="h-1 w-12 bg-gradient-to-r from-transparent via-primary to-transparent animate-line-expand"></div>
      </div>
    </div>
  </div>
);

const AppContent = () => {
  const { user, initialized: userInitialized } = useUserAuth();
  const { admin, initialized: adminInitialized } = useAdminAuth();

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
