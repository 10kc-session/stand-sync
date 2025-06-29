/**
 * A route guard component that protects routes based on user authentication and profile setup status.
 *
 * - If the authentication state is loading, displays a loading spinner.
 * - If the user is not authenticated, redirects to the authentication page (`/auth`).
 * - If the user is authenticated but has not completed setup, redirects to the setup page (`/setup`), unless already on that page.
 * - If the user has completed setup but tries to access the setup page, redirects to the home page (`/`).
 * - Otherwise, renders the child components.
 *
 * @param {ProtectedRouteProps} props - The props for the ProtectedRoute component.
 * @param {ReactNode} props.children - The child components to render if access is allowed.
 * @returns {JSX.Element} The protected route logic and children or a redirect/loading indicator.
 */
// src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { user, userProfile, loading } = useUserAuth();
    const location = useLocation();

    if (loading) {

        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {

        return <Navigate to="/auth" replace />;
    }

    if (user && !userProfile?.hasCompletedSetup) {
        if (location.pathname !== '/setup') {
            return <Navigate to="/setup" replace />;
        }
    }

    if (userProfile?.hasCompletedSetup && location.pathname === '/setup') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;