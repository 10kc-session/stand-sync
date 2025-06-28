import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUserAuth } from "./UserAuthContext";

type Admin = {
  email: string | null;
  uid: string;
};

type AdminAuthContextType = {
  admin: Admin | null;
  loading: boolean;
  initialized: boolean; // NEW: Track initialization state
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: userAuthLoading, initialized: userAuthInitialized } = useUserAuth(); // NEW: Added initialized
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // NEW

  useEffect(() => {
    // Only check admin status if user auth is initialized
    if (!userAuthInitialized) return;

    setLoading(true);

    if (!user) {
      setAdmin(null);
      setLoading(false);
      setInitialized(true); // NEW
      return;
    }

    user.getIdToken(true)
      .then(() => user.getIdTokenResult()) // Get fresh token result
      .then((idTokenResult) => {
        if (idTokenResult.claims.isAdmin === true) {
          setAdmin({ email: user.email, uid: user.uid });
        } else {
          setAdmin(null);
        }
      })
      .catch((error) => {
        console.error("Error verifying admin status:", error);
        setAdmin(null);
      })
      .finally(() => {
        setLoading(false);
        setInitialized(true); // NEW
      });
  }, [user, userAuthInitialized]); // UPDATED dependency

  return (
    <AdminAuthContext.Provider value={{ admin, loading, initialized }}> {/* UPDATED */}
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (ctx === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return ctx;
};