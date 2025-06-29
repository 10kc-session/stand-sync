/**
 * Provides authentication and user profile context for the application.
 *
 * This context manages the Firebase authentication state and listens for changes
 * to the user's profile document in Firestore. It exposes the current user, their
 * profile, and loading/initialization states to consumers.
 *
 * @remarks
 * - The `UserAuthProvider` should wrap your application's component tree to provide
 *   access to authentication and profile data.
 * - The `useUserAuth` hook can be used to access the context values within child components.
 *
 * @interface UserProfile
 * Represents the user's profile data stored in Firestore.
 * @property {string} [employeeId] - The employee's unique identifier.
 * @property {boolean} [hasCompletedSetup] - Indicates if the user has completed setup.
 *
 * @interface AuthContextType
 * The shape of the authentication context.
 * @property {User | null} user - The current authenticated Firebase user, or null if not signed in.
 * @property {UserProfile | null} userProfile - The user's profile data from Firestore, or null if not available.
 * @property {boolean} loading - True if authentication or profile data is loading.
 * @property {boolean} initialized - True if both authentication and profile data have finished loading.
 *
 * @component
 * @param {object} props
 * @param {ReactNode} props.children - The child components that will have access to the context.
 * @returns {JSX.Element} The provider component that supplies authentication and profile context.
 *
 * @function useUserAuth
 * Custom hook to access the authentication context.
 * @throws {Error} If used outside of a `UserAuthProvider`.
 * @returns {AuthContextType} The current authentication and profile context values.
 */
// src/context/UserAuthContext.tsx

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/integrations/firebase/client";
import { doc, DocumentData, onSnapshot, Unsubscribe } from "firebase/firestore";

export interface UserProfile extends DocumentData {
    employeeId?: string;
    hasCompletedSetup?: boolean;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    initialized: boolean;
}

const UserAuthContext = createContext<AuthContextType | undefined>(undefined);

export const UserAuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // loadingAuth covers onAuthStateChanged; loadingProfile covers Firestore snapshot
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // initialized only once both auth & profile are settled
    const initialized = !loadingAuth && !loadingProfile;

    useEffect(() => {
        let unsubscribeProfile: Unsubscribe | null = null;

        // 1) Listen for Firebase Auth state
        const unsubscribeAuth = onAuthStateChanged(
            auth,
            (currentUser) => {
                setUser(currentUser);
                setLoadingAuth(false);

                // tear down any previous profile listener
                if (unsubscribeProfile) {
                    unsubscribeProfile();
                    unsubscribeProfile = null;
                }

                if (currentUser) {
                    // 2) Listen for the corresponding employee doc
                    const employeeDocRef = doc(db, "employees", currentUser.uid);
                    setLoadingProfile(true);
                    unsubscribeProfile = onSnapshot(
                        employeeDocRef,
                        (snap) => {
                            setUserProfile(snap.exists() ? (snap.data() as UserProfile) : null);
                            setLoadingProfile(false);
                        },
                        (error) => {
                            console.error(
                                "Error fetching employee profile snapshot:",
                                error
                            );
                            setUserProfile(null);
                            setLoadingProfile(false);
                        }
                    );
                } else {
                    // no user → no profile
                    setUserProfile(null);
                    setLoadingProfile(false);
                }
            },
            (error) => {
                console.error("onAuthStateChanged error:", error);
                setUser(null);
                setUserProfile(null);
                setLoadingAuth(false);
                setLoadingProfile(false);
            }
        );

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) {
                unsubscribeProfile();
            }
        };
    }, []);

    return (
        <UserAuthContext.Provider
            value={{
                user,
                userProfile,
                loading: loadingAuth || loadingProfile,
                initialized,
            }}
        >
            {children}
        </UserAuthContext.Provider>
    );
};

export const useUserAuth = (): AuthContextType => {
    const ctx = useContext(UserAuthContext);
    if (!ctx) {
        throw new Error("useUserAuth must be used within a UserAuthProvider");
    }
    return ctx;
};
