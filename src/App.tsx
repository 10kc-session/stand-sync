import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AdminAuthProvider } from "./context/AdminAuthContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import HomeRedirector from "./components/HomeRedirector"; // <-- IMPORT NEW COMPONENT

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Standups from "./pages/Standups";
import Attendance from "./pages/Attendance";
import AdminLogin from "./pages/AdminLogin";
import AdminHome from "./pages/AdminHome";
import AdminEmployees from "./pages/AdminEmployees";
import AuthPage from "./pages/AuthPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserAuthProvider>
          <AdminAuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* --- CHANGE 1: Use HomeRedirector for the root path --- */}
              <Route path="/" element={<HomeRedirector />} />

              {/* ProtectedRoute is still used for other user pages */}
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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminAuthProvider>
        </UserAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;