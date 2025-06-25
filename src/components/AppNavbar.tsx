import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// --- Firebase Imports & Hooks ---
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { auth } from "@/integrations/firebase/client";
import { signOut } from "firebase/auth";
import ProfileEditor from "./ProfileEditor";

const links = [
  { path: "/", label: "Home" },
  { path: "/standups", label: "Standups" },
  { path: "/attendance", label: "Attendance" },
];

export default function AppNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const { user, loading } = useUserAuth();
  const { admin } = useAdminAuth();

  const isLoggedIn = !!user || !!admin;
  const displayName = user?.displayName || admin?.email || "User";
  const displayAvatar = user?.photoURL || undefined;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const isAdmin = !!admin;

  return (
    <nav className="w-full flex justify-center bg-background border-b">
      <ul className="flex gap-4 py-4">
        {links.map(({ path, label }) => (
          <li key={path}>
            <Link
              to={path}
              className={cn(
                "py-2 px-3 rounded hover:bg-muted/40 transition-colors",
                pathname === path && "font-semibold bg-muted"
              )}
            >
              {label}
            </Link>
          </li>
        ))}
        {isAdmin && (
          <li>
            <Link
              to="/admin/employees"
              className={cn(
                "py-2 px-3 rounded hover:bg-muted/40 transition-colors",
                pathname === "/admin/employees" && "font-semibold bg-muted"
              )}
            >
              Employees
            </Link>
          </li>
        )}
        {!loading && isLoggedIn && (
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 px-2 text-muted-foreground hover:bg-muted/30 rounded transition-colors"
                >
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-bold">
                      {displayName?.slice(0, 1).toUpperCase() ?? "U"}
                    </span>
                  )}
                  <span className="hidden md:inline">{displayName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* --- THIS IS THE ONLY CHANGE --- */}
                {/* We now show this for ANY logged-in user, including admins */}
                {user && (
                  <>
                    <DropdownMenuItem onClick={() => setShowProfile(true)}>
                      Change username / image
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ProfileEditor open={showProfile} onOpenChange={setShowProfile} />
          </li>
        )}
      </ul>
    </nav>
  );
}