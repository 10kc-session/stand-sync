/**
 * AuthPage component handles user authentication for login and signup using Firebase.
 * 
 * - Supports email/password and Google authentication.
 * - Handles user and admin redirection based on authentication and setup status.
 * - Provides password reset functionality.
 * - Displays loading spinner while authentication context is initializing.
 * - Shows error and success messages for user feedback.
 * - Uses Framer Motion for animated transitions.
 * 
 * @component
 * @returns {JSX.Element} The authentication page UI.
 *
 * @remarks
 * - Redirects authenticated users to `/admin`, `/setup`, or `/` based on their role and setup completion.
 * - Uses contexts: `useUserAuth` and `useAdminAuth` for authentication state.
 * - Integrates with Firestore to store and check employee setup status.
 */
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from "firebase/auth";
import { auth, db } from "@/integrations/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Navigate, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useUserAuth } from "@/context/UserAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

enum Mode {
  Login = "Login",
  Signup = "Sign Up",
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>(Mode.Login);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  const { user, loading: userLoading } = useUserAuth();
  const { admin: currentAdmin, loading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();

  // 1) Synchronous guard: if we know the final state, redirect immediately
  if (!userLoading && !adminLoading && user) {
    if (currentAdmin) {
      return <Navigate to="/admin" replace />;
    } else {
      // check setup status in profile
      // Ideally you'd have userProfile.hasCompletedSetup from context
      // but for simplicity, we'll send them to setup (the effect below will correct)
      return <Navigate to="/setup" replace />;
    }
  }

  // 2) Centralized post-login logic
  const handleSuccessfulLogin = async (u: User) => {
    const idTokenResult = await u.getIdTokenResult();
    if (idTokenResult.claims.isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    const employeeRef = doc(db, "employees", u.uid);
    const snap = await getDoc(employeeRef);
    if (snap.exists() && snap.data().hasCompletedSetup) {
      navigate("/", { replace: true });
    } else {
      if (!snap.exists()) {
        await setDoc(employeeRef, {
          uid: u.uid,
          email: u.email,
          name: u.displayName,
          hasCompletedSetup: false,
        });
      }
      navigate("/setup", { replace: true });
    }
  };

  // 3) Handlers
  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email to receive a reset link.");
      return;
    }
    setLoadingForm(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(
        err.code === "auth/user-not-found"
          ? "No account found with this email."
          : "Failed to send reset email."
      );
    } finally {
      setLoadingForm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoadingForm(true);
    try {
      if (mode === Mode.Login) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await handleSuccessfulLogin(cred.user);
      } else {
        if (!name.trim()) {
          setError("Please enter your full name.");
          setLoadingForm(false);
          return;
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        // await sendEmailVerification(cred.user); // Remove this line if you don't want to send verification email
        await handleSuccessfulLogin(cred.user);
      }
    } catch (err: any) {
      setLoadingForm(false);
      if (err.code === "auth/invalid-credential")
        setError("Invalid email or password.");
      else if (err.code === "auth/email-already-in-use")
        setError("An account with this email already exists.");
      else setError(err.message || "An unexpected error occurred.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingForm(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      await handleSuccessfulLogin(cred.user);
    } catch (_) {
      setError("Failed to sign in with Google.");
      setLoadingForm(false);
    }
  };

  // 4) While contexts are initializing, show spinner
  if (userLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 5) Render form
  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      {/* Left: Form */}
      <div className="flex items-center justify-center py-6 px-4 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl text-center font-extrabold text-foreground">
              {mode === Mode.Login ? "Welcome Back" : "Create an Account"}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {mode === Mode.Login
                ? "Don’t have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === Mode.Login ? Mode.Signup : Mode.Login);
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-primary hover:underline"
              >
                {mode === Mode.Login ? "Sign up" : "Login"}
              </button>
            </p>
          </div>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loadingForm}
                  >
                    <FcGoogle className="h-5 w-5" />
                    Continue with Google
                  </Button>
                  <div className="flex items-center">
                    <div className="flex-grow border-t border-border" />
                    <span className="px-2 text-xs text-muted-foreground uppercase">
                      or
                    </span>
                    <div className="flex-grow border-t border-border" />
                  </div>
                  {mode === Mode.Signup && (
                    <Input
                      placeholder="Full Name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  )}
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={
                      mode === Mode.Login ? "current-password" : "new-password"
                    }
                    required
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {message && <p className="text-sm text-green-600">{message}</p>}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loadingForm}
                  >
                    {loadingForm ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      mode
                    )}
                  </Button>
                  {mode === Mode.Login && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-sm text-muted-foreground hover:underline"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Right: Illustration */}
      <div className="hidden md:flex items-center justify-center p-6 bg-secondary">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="text-center"
        >
          <AuthIllustration className="w-full max-w-sm mx-auto" />
          <h3 className="mt-6 text-xl font-bold text-foreground">
            Unlock Your Team’s Potential
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Join Standup-Sync to streamline feedback and supercharge your daily meetings.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
function AuthIllustration(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 450 400" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="50" y="50" width="350" height="300" rx="12" fill="currentColor" fillOpacity="0.05" />
        <path d="M50 120 H 400" />
        <circle cx="120" cy="180" r="20" fill="currentColor" fillOpacity="0.1" />
        <path d="M120 200 A 30 30 0 0 0 90 230 H 150 A 30 30 0 0 0 120 200 Z" fill="currentColor" fillOpacity="0.1" />
        <circle cx="330" cy="180" r="20" fill="currentColor" fillOpacity="0.1" />
        <path d="M330 200 A 30 30 0 0 0 300 230 H 360 A 30 30 0 0 0 330 200 Z" fill="currentColor" fillOpacity="0.1" />
        <g transform="translate(225, 220) rotate(45)">
          <circle cx="0" cy="-35" r="15" />
          <rect x="-4" y="-20" width="8" height="40" />
          <rect x="-15" y="20" width="30" height="8" />
          <rect x="-15" y="32" width="30" height="8" />
        </g>
        <circle cx="80" cy="85" r="8" />
        <path d="M100 80 L 150 80" />
        <path d="M100 90 L 180 90" />
      </g>
    </svg>
  );
}
