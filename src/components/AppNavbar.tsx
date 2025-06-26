import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useUserAuth } from "@/context/UserAuthContext";
import { auth } from "@/integrations/firebase/client";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { LayoutDashboard, LogOut, UserCircle } from "lucide-react"; // Import icons
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ProfileEditor from "./ProfileEditor";

const userLinks = [
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
  const isAdmin = !!admin;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <header className="w-full bg-background border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / App Name */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <LayoutDashboard className="h-6 w-6" />
            <span>Standup-Sync</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            {userLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md text-muted-foreground transition-colors hover:text-foreground",
                  pathname === path && "text-foreground"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Profile Dropdown */}
          <div className="flex items-center">
            {!loading && isLoggedIn && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full p-1 hover:bg-muted/50 transition-colors">
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt={displayName}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold">
                          {displayName?.slice(0, 1).toUpperCase() ?? "U"}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem disabled>
                      <div className="font-medium">{displayName}</div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate('/admin/employees')}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    )}
                    {user && (
                      <DropdownMenuItem onClick={() => setShowProfile(true)}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Edit Profile</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ProfileEditor open={showProfile} onOpenChange={setShowProfile} />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
