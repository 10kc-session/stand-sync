
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";

type Props = {
  mode: "Login" | "Sign Up";
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  loadingForm: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoogle: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
};

const TeamMemberAuthCard: React.FC<Props> = ({
  mode, email, setEmail, name, setName, password, setPassword,
  error, loadingForm, onSubmit, onGoogle, onSwitchMode, onBack
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{mode === "Login" ? "Team Member Login" : "Team Member Sign Up"}</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit}>
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full flex gap-2 items-center justify-center"
            type="button"
            onClick={onGoogle}
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
          {mode === "Sign Up" && (
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
            autoComplete={mode === "Login" ? "current-password" : "new-password"}
          />
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button type="submit" className="w-full mt-2" disabled={loadingForm}>
            {loadingForm ? "Loading..." : (mode === "Login" ? "Login" : "Sign Up")}
          </Button>
          <div className="flex justify-between text-sm pt-3">
            <button type="button" className="underline" onClick={onSwitchMode}>
              {mode === "Login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Login"}
            </button>
            <button type="button" className="underline" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </form>
    </CardContent>
  </Card>
);

export default TeamMemberAuthCard;
