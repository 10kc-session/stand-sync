// src/context/UserAuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/integrations/firebase/client';
import { doc, DocumentData, onSnapshot } from 'firebase/firestore';

interface UserProfile extends DocumentData {
    employeeId?: string;
    hasCompletedSetup?: boolean;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    initialized: boolean; // NEW: Track initialization state
}

const UserAuthContext = createContext<AuthContextType | undefined>(undefined);

interface UserAuthProviderProps {
    children: ReactNode;
}

export const UserAuthProvider = ({ children }: UserAuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false); // NEW

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setInitialized(true); // NEW: Set initialized immediately

                // --- MODIFIED: Pointing to the 'employees' collection ---
                const employeeDocRef = doc(db, 'employees', currentUser.uid);

                const unsubscribeProfile = onSnapshot(employeeDocRef, (docSnap) => {
                    setUserProfile(docSnap.exists() ? docSnap.data() : null);
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore snapshot error on employees collection:", error);
                    setUserProfile(null);
                    setLoading(false);
                });

                return () => unsubscribeProfile();
            } else {
                setUser(null);
                setUserProfile(null);
                setLoading(false);
                setInitialized(true); // NEW: Set initialized immediately
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const value = { user, userProfile, loading, initialized }; // UPDATED

    return (
        <UserAuthContext.Provider value={value}>
            {children}
        </UserAuthContext.Provider>
    );
};

export const useUserAuth = () => {
    const context = useContext(UserAuthContext);
    if (context === undefined) {
        throw new Error('useUserAuth must be used within a UserAuthProvider');
    }
    return context;
};