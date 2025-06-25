import React, { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from "firebase/auth";
// --- CHANGE 1: Using consistent import path ---
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import AppNavbar from "@/components/AppNavbar";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useUserAuth } from "@/context/UserAuthContext";

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
  const navigate = useNavigate();

  useEffect(() => {
    if (!userLoading && user) {
      navigate("/standups");
    }
  }, [user, userLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoadingForm(true);

    if (mode === Mode.Login) {
      try {
        await signInWithEmailAndPassword(auth, email, password);

        // --- CHANGE 2: Removed the email verification check ---
        // We removed this block to allow an admin to log in even if their email
        // is not verified. Our AdminAuthContext will handle role checking,
        // and ProtectedRoute can handle verification for regular users if needed.
        /*
        if (!userCredential.user.emailVerified) {
          setError("Email not verified...");
          await auth.signOut();
        }
        */
        // On successful login, the useEffect hook will now handle the redirect.

      } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          setError("Invalid email or password. Please try again.");
        } else {
          setError("An error occurred during login.");
        }
      }
    } else { // Signup Mode
      try {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await sendEmailVerification(userCredential.user);
        setMessage("Registration successful! A verification email has been sent. Please check your inbox to verify your account.");
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          setError("This email address is already in use.");
        } else {
          setError(error.message || "An error occurred during sign-up.");
        }
      }
    }
    setLoadingForm(false);
  };

  const handleGoogleLogin = async () => {
    setLoadingForm(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // On successful login, the useEffect hook will handle the redirect.
    } catch (error: any) {
      setError("Failed to sign in with Google. Please try again.");
      console.error("Google sign-in error:", error);
    }
    setLoadingForm(false);
  };

  if (user && !userLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm mx-auto">
          <CardHeader>
            <CardTitle>{mode}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full flex gap-2 items-center justify-center"
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loadingForm}
                >
                  <FcGoogle className="text-xl" />
                  {loadingForm ? "Signing in..." : "Sign in with Google"}
                </Button>
                <div className="flex items-center gap-2">
                  <span className="border-b grow border-muted-foreground/10"></span>
                  <span className="text-xs text-muted-foreground">or</span>
                  <span className="border-b grow border-muted-foreground/10"></span>
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  autoComplete="username"
                />
                {mode === Mode.Signup && (
                  <Input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full Name"
                    required
                    autoComplete="name"
                  />
                )}
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  autoComplete={
                    mode === Mode.Login ? "current-password" : "new-password"
                  }
                />
                {error && <div className="text-sm text-red-500">{error}</div>}
                {message && <div className="text-sm text-green-500">{message}</div>}
                <Button type="submit" className="w-full mt-2" disabled={loadingForm}>
                  {loadingForm ? "Loading..." : mode}
                </Button>
                <div className="flex justify-center text-sm pt-3">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setMode(mode === Mode.Login ? Mode.Signup : Mode.Login);
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    {mode === Mode.Login
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Login"}
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}