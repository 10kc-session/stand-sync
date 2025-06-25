import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
// --- CHANGE 1: Corrected the import path ---
import { auth } from '@/integrations/firebase/client';

// Define the shape of the context data
interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const UserAuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider component
interface UserAuthProviderProps {
    children: ReactNode;
}

export const UserAuthProvider = ({ children }: UserAuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // --- CHANGE 2: Removed the emailVerified check ---
            // This context now provides the raw user object.
            // This is crucial for the AdminAuthContext to be able to check
            // an admin's claims, even if their email is not yet verified.
            setUser(currentUser);
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    const value = { user, loading };

    return (
        <UserAuthContext.Provider value={value}>
            {children}
        </UserAuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useUserAuth = () => {
    const context = useContext(UserAuthContext);
    if (context === undefined) {
        throw new Error('useUserAuth must be used within a UserAuthProvider');
    }
    return context;
};