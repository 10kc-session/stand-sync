/**
 * Context and provider for managing admin authentication state.
 *
 * This context listens to Firebase Auth's ID token changes to determine if the current user
 * has the `isAdmin` custom claim. It exposes the admin user object, admin status, loading state,
 * and initialization state to consumers.
 *
 * @typedef Admin
 * @property {string | null} email - The admin user's email address.
 * @property {string} uid - The admin user's unique identifier.
 *
 * @typedef AdminAuthContextType
 * @property {Admin | null} admin - The current admin user object, or null if not an admin.
 * @property {boolean} isAdmin - Whether the current user is an admin.
 * @property {boolean} loading - Whether the admin authentication state is loading.
 * @property {boolean} initialized - Whether the admin authentication context has completed its initial check.
 *
 * @component
 * @param {object} props
 * @param {ReactNode} props.children - The child components that will have access to the admin auth context.
 * @returns {JSX.Element} The provider component that supplies admin authentication state.
 *
 * @example
 * <AdminAuthProvider>
 *   <App />
 * </AdminAuthProvider>
 *
 * @function useAdminAuth
 * @returns {AdminAuthContextType} The admin authentication context value.
 * @throws {Error} If used outside of an AdminAuthProvider.
 */
// src/context/AdminAuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { auth } from "@/integrations/firebase/client";
import { useUserAuth } from "./UserAuthContext";
import type { User } from "firebase/auth";

type Admin = {
  email: string | null;
  uid: string;
};

type AdminAuthContextType = {
  admin: Admin | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
  undefined
);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const { initialized: userAuthInitialized } = useUserAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Wait until the user auth context has finished its initial check
    if (!userAuthInitialized) return;
    setLoading(true);

    // Listen for ID token changes (including custom-claim updates)
    const unsubscribe = auth.onIdTokenChanged(async (u: User | null) => {
      if (!u) {
        setAdmin(null);
      } else {
        try {
          const idTokenResult = await u.getIdTokenResult();
          if (idTokenResult.claims.isAdmin) {
            setAdmin({ email: u.email, uid: u.uid });
          } else {
            setAdmin(null);
          }
        } catch (err) {
          console.error("Error verifying admin claim:", err);
          setAdmin(null);
        }
      }
      setLoading(false);
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [userAuthInitialized]);

  const isAdmin = Boolean(admin);

  return (
    <AdminAuthContext.Provider
      value={{ admin, isAdmin, loading, initialized }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (ctx === undefined) {
    throw new Error(
      "useAdminAuth must be used within an AdminAuthProvider"
    );
  }
  return ctx;
};
