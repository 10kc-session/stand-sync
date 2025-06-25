import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUserAuth } from "./UserAuthContext"; // We need the main user context to get the Firebase user

// The new Admin type will be based on the Firebase user object
type Admin = {
  email: string | null;
  uid: string;
};

// The new context will only provide the admin object, as login/logout are handled elsewhere
type AdminAuthContextType = {
  admin: Admin | null;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUserAuth(); // Get the currently logged-in Firebase user
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    // This effect runs whenever the main Firebase user logs in or out
    if (user) {
      // When a user is logged in, check their ID token for the admin claim.
      // Passing `true` to getIdTokenResult forces a refresh to get the latest claims.
      user.getIdTokenResult(true)
        .then((idTokenResult) => {
          // Check if the custom claim 'isAdmin' is set to true on the token
          if (idTokenResult.claims.isAdmin === true) {
            // If it is, this user is an admin. Set the admin state.
            setAdmin({ email: user.email, uid: user.uid });
          } else {
            // If the claim doesn't exist or isn't true, they are not an admin.
            setAdmin(null);
          }
        })
        .catch(() => {
          // If there's an error getting the token, assume they are not an admin.
          setAdmin(null);
        });
    } else {
      // If no user is logged in, there can be no admin.
      setAdmin(null);
    }
  }, [user]); // This logic re-runs every time the user state changes

  return (
    // We only need to provide the 'admin' object to the rest of the app
    <AdminAuthContext.Provider value={{ admin }}>
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