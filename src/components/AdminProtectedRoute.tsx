import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useUserAuth } from '../context/UserAuthContext';
import { ReactNode } from 'react';

interface AdminProtectedRouteProps {
    children: ReactNode;
}

const AdminProtectedRoute = ({ children }: AdminProtectedRouteProps) => {
    const { admin } = useAdminAuth();
    const { loading } = useUserAuth();

    // We use the main user loading state to wait for auth check
    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    // If loading is done and there is no admin object, redirect
    if (!admin) {
        // Send them to the admin login "gateway" page
        return <Navigate to="/admin/login" replace />;
    }

    // If an admin exists, render the protected admin component
    return <>{children}</>;
};

export default AdminProtectedRoute;