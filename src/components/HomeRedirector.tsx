/**
 * Redirects users to the appropriate home page based on their authentication status.
 *
 * - If authentication state is still loading, displays a loading indicator.
 * - If the user is an admin, redirects to the admin dashboard (`/admin`).
 * - If the user is a regular user, redirects to the user home page (`/index`).
 * - If no user is authenticated, redirects to the authentication page (`/auth`).
 *
 * Utilizes `useUserAuth` and `useAdminAuth` context hooks to determine authentication state.
 *
 * @component
 */
import { Navigate } from "react-router-dom";
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";

const HomeRedirector = () => {
    const { user, loading: userLoading, initialized: userInit } = useUserAuth();
    const { admin, loading: adminLoading, initialized: adminInit } = useAdminAuth();

    const isLoading = userLoading || adminLoading || !userInit || !adminInit;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                Loading…
            </div>
        );
    }

    if (admin) {
        return <Navigate to="/admin" replace />;
    }

    if (user) {
        return <Navigate to="/index" replace />;
    }

    return <Navigate to="/auth" replace />;
};

export default HomeRedirector;
