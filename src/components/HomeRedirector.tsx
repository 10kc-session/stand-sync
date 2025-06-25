import { Navigate } from "react-router-dom";
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Index from "@/pages/Index";

const HomeRedirector = () => {
    const { user, loading: userLoading } = useUserAuth();
    // --- CHANGE 1: Only get 'admin' from the context ---
    const { admin } = useAdminAuth();

    // --- CHANGE 2: The true loading state depends ONLY on the primary user auth check ---
    const isLoading = userLoading;

    if (isLoading) {
        // While checking authentication, show a full-page loading indicator
        return (
            <div className="min-h-screen flex items-center justify-center">
                Loading...
            </div>
        );
    }

    // Once loading is complete, make a decision
    if (admin) {
        // If the user is an admin, redirect them immediately to the admin dashboard
        return <Navigate to="/admin" replace />;
    }

    if (user && !admin) {
        // If it's a regular, non-admin user, show them the normal Index/Home page
        return <Index />;
    }

    // This check will now correctly handle the case after loading is false
    if (!user) {
        // If there is no user at all, redirect to the login page
        return <Navigate to="/auth" replace />;
    }

    // Fallback case, should not be reached in normal flow
    return (
        <div className="min-h-screen flex items-center justify-center">
            Loading...
        </div>
    );
};

export default HomeRedirector;