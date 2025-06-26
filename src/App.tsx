import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AdminAuthProvider } from "./context/AdminAuthContext";
import { UserAuthProvider, useUserAuth } from "./context/UserAuthContext"; // 1. Import useUserAuth
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

// --- Import all your pages ---
import LandingPage from "./pages/LandingPage"; // 2. Import the new LandingPage
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Standups from "./pages/Standups";
import Attendance from "./pages/Attendance";
import AdminLogin from "./pages/AdminLogin";
import AdminHome from "./pages/AdminHome";
import AdminEmployees from "./pages/AdminEmployees";
import AuthPage from "./pages/AuthPage";
import AdminEmployeeDetail from "./pages/AdminEmployeeDetail";

const queryClient = new QueryClient();

const AppContent = () => {
  // We move the logic into a child component to access the context
  const { user } = useUserAuth();

  return (
    <Routes>
      {/* --- CHANGE 3: The root route now shows LandingPage or the dashboard --- */}
      <Route path="/" element={user ? <Index /> : <LandingPage />} />

      <Route path="/auth" element={<AuthPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* --- All your protected routes remain the same --- */}
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
            {/* We render the new AppContent component here */}
            <AppContent />
          </AdminAuthProvider>
        </UserAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
