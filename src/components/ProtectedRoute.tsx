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

    // --- ADD THIS LOG AT THE TOP ---
    console.log(`ProtectedRoute at [${location.pathname}]: loading=${loading}, user=${!!user}, setupComplete=${userProfile?.hasCompletedSetup}`);

    if (loading) {
        console.log(`Decision for [${location.pathname}]: Rendering Loader`); // ADD THIS
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        console.log(`Decision for [${location.pathname}]: Navigating to /auth`); // ADD THIS
        return <Navigate to="/auth" replace />;
    }

    if (user && !userProfile?.hasCompletedSetup) {
        if (location.pathname !== '/setup') {
            console.log(`Decision for [${location.pathname}]: Navigating to /setup`); // ADD THIS
            return <Navigate to="/setup" replace />;
        }
    }

    if (userProfile?.hasCompletedSetup && location.pathname === '/setup') {
        console.log(`Decision for [${location.pathname}]: Navigating to /`); // ADD THIS
        return <Navigate to="/" replace />;
    }

    console.log(`Decision for [${location.pathname}]: Rendering children`); // ADD THIS
    return <>{children}</>;
};

export default ProtectedRoute;