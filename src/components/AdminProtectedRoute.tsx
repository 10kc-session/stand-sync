/**
 * A route protection component for admin-only pages.
 * 
 * This component checks if an admin user is authenticated using the `useAdminAuth` context.
 * While the main user authentication state is loading (from `useUserAuth`), it displays a loading indicator.
 * If the admin is not authenticated after loading, it redirects to the admin login page.
 * If authenticated, it renders the provided child components.
 *
 * @param {AdminProtectedRouteProps} props - The props for the component.
 * @param {ReactNode} props.children - The child components to render if the admin is authenticated.
 * @returns {JSX.Element} The protected route component, a loading indicator, or a redirect.
 */
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