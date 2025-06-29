/**
 * TeamMemberAuthCard component renders a card UI for team member authentication,
 * supporting both "Login" and "Sign Up" modes. It provides form fields for email,
 * password, and (optionally) full name, as well as Google sign-in integration.
 * Displays loading state, error messages, and allows switching between modes or going back.
 *
 * @param mode - Determines whether the card is in "Login" or "Sign Up" mode.
 * @param formState - The current state of the form fields (email, name, password).
 * @param setFormState - Function to update the form state.
 * @param error - Error message to display, if any.
 * @param loading - Indicates if a submission or authentication is in progress.
 * @param onSubmit - Handler for form submission.
 * @param onGoogle - Handler for Google sign-in button click.
 * @param onSwitchMode - Handler to switch between "Login" and "Sign Up" modes.
 * @param onBack - Handler for the "Back" button.
 *
 * @returns A React component rendering the authentication card UI.
 */
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FcGoogle } from "react-icons/fc";

interface FormState {
  email: string;
  name: string;
  password: string;
}

type Props = {
  mode: "Login" | "Sign Up";
  formState: FormState;
  setFormState: (state: FormState) => void;
  error: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoogle: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
};

export default function TeamMemberAuthCard({
  mode,
  formState,
  setFormState,
  error,
  loading,
  onSubmit,
  onGoogle,
  onSwitchMode,
  onBack,
}: Props) {
  const { email, name, password } = formState;

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState({ ...formState, email: e.target.value }),
    [formState, setFormState]
  );
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState({ ...formState, name: e.target.value }),
    [formState, setFormState]
  );
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState({ ...formState, password: e.target.value }),
    [formState, setFormState]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "Login" ? "Team Member Login" : "Team Member Sign Up"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Google sign-in */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-center"
            type="button"
            onClick={onGoogle}
            disabled={loading}
          >
            <FcGoogle className="mr-2" />
            {loading ? "Signing in…" : "Sign in with Google"}
          </Button>

          {/* separator */}
          <div className="flex items-center gap-2">
            <span
              role="separator"
              className="flex-grow border-b border-muted-foreground/10"
            />
            <span className="text-xs text-muted-foreground">or</span>
            <span
              role="separator"
              className="flex-grow border-b border-muted-foreground/10"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Email"
              required
              autoComplete="username"
            />
          </div>

          {/* Name (signup only) */}
          {mode === "Sign Up" && (
            <div>
              <label htmlFor="name" className="sr-only">
                Full Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Full Name"
                required
                autoComplete="name"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Password"
              required
              autoComplete={
                mode === "Login" ? "current-password" : "new-password"
              }
            />
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "Login"
                ? "Login"
                : "Sign Up"}
          </Button>

          {/* Footer links */}
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="underline"
              onClick={onSwitchMode}
            >
              {mode === "Login"
                ? "Don’t have an account? Sign up"
                : "Already have an account? Login"}
            </button>
            <button type="button" className="underline" onClick={onBack}>
              Back
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
