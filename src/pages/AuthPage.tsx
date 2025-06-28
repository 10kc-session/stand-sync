// src/pages/AuthPage.tsx

import React, { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
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
import { useNavigate } from "react-router-dom";
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

  // If someone is already signed in (e.g. reload),
  // send them where they belong automatically.
  useEffect(() => {
    if (userLoading || adminLoading) return;
    if (user) {
      if (currentAdmin) {
        navigate("/admin", { replace: true });
      }
      // Note: non-admins get routed inside handleSuccessfulLogin below,
      // so we don’t redirect them here.
    }
  }, [user, userLoading, currentAdmin, adminLoading, navigate]);

  // Unified post-login hook
  const handleSuccessfulLogin = async (u: User) => {
    // 1) Check admin claim on the fresh token
    const idTokenResult = await u.getIdTokenResult();
    if (idTokenResult.claims.isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }

    // 2) Otherwise treat them as an employee
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
        if (password.length < 6)
          throw new Error("Password must be at least 6 characters.");
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await updateProfile(cred.user, { displayName: name });
        await handleSuccessfulLogin(cred.user);
        sendEmailVerification(cred.user);
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

  // Show spinner while we check if someone’s already signed in
  if (userLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Left: Form */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
              {mode === Mode.Login ? "Welcome Back" : "Create an Account"}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {mode === Mode.Login
                ? "Don't have an account?"
                : "Already have an account?"}
              <button
                onClick={() => {
                  setMode(
                    mode === Mode.Login ? Mode.Signup : Mode.Login
                  );
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-primary hover:underline ml-1"
              >
                {mode === Mode.Login ? "Sign up" : "Login"}
              </button>
            </p>
          </div>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full flex gap-3 items-center"
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loadingForm}
                  >
                    <FcGoogle className="h-5 w-5" />
                    Continue with Google
                  </Button>
                  <div className="flex items-center">
                    <div className="flex-grow border-t border-border" />
                    <span className="mx-4 text-xs uppercase text-muted-foreground">
                      Or
                    </span>
                    <div className="flex-grow border-t border-border" />
                  </div>
                  <div className="space-y-2">
                    {mode === Mode.Signup && (
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        required
                        autoComplete="name"
                      />
                    )}
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      autoComplete="email"
                    />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      autoComplete={
                        mode === Mode.Login
                          ? "current-password"
                          : "new-password"
                      }
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {message && (
                    <p className="text-sm text-green-600">{message}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loadingForm}
                  >
                    {loadingForm && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {loadingForm ? "Please wait..." : mode}
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
      <div className="hidden bg-secondary lg:flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-center"
        >
          {/* Your SVG or image here */}
          <AuthIllustration className="w-full max-w-md mx-auto" />
          <h3 className="mt-8 text-2xl font-bold text-foreground">
            Unlock Your Team's Potential
          </h3>
          <p className="mt-2 text-muted-foreground">
            Join Standup-Sync to streamline feedback and supercharge your daily
            meetings.
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