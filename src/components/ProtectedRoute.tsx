import { Navigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { user, loading } = useUserAuth();

    if (loading) {
        // You can return a loading spinner here
        return <div>Loading...</div>;
    }

    if (!user) {
        // Redirect them to the /auth page, but save the current location they were
        // trying to go to. This allows us to send them back there after login.
        return <Navigate to="/auth" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;