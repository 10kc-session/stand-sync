import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AdminAuthProvider } from "./context/AdminAuthContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import HomeRedirector from "./components/HomeRedirector";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Standups from "./pages/Standups";
import Attendance from "./pages/Attendance";
import AdminLogin from "./pages/AdminLogin";
import AdminHome from "./pages/AdminHome";
import AdminEmployees from "./pages/AdminEmployees";
import AuthPage from "./pages/AuthPage";
// --- CHANGE 1: Import the new detail page component ---
import AdminEmployeeDetail from "./pages/AdminEmployeeDetail";

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

              <Route path="/" element={<HomeRedirector />} />

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

              {/* --- CHANGE 2: Add the new dynamic route --- */}
              {/* The ':employeeId' part is a URL parameter that can change */}
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
          </AdminAuthProvider>
        </UserAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;