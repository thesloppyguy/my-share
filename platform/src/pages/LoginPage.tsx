import { FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSnapshot, OtpChallenge } from "@/types";

type LoginPageProps = {
  onAuthenticated: (snapshot: AppSnapshot) => void;
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const challenge = await invoke<OtpChallenge>("request_otp", {
        args: { email: email.trim() },
      });
      setEmail(challenge.email);
      setDevCode(challenge.dev_code);
      setStep("otp");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const snapshot = await invoke<AppSnapshot>("verify_otp", {
        args: { email: email.trim(), code: code.trim() },
      });
      onAuthenticated(snapshot);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            my-share
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {step === "email" ? "Sign in" : "Enter code"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "email"
              ? "Use your email to receive a one-time passcode."
              : `We sent a code to ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form className="grid gap-4" onSubmit={sendOtp}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" disabled={busy || !email.trim()}>
              Continue
            </Button>
          </form>
        ) : (
          <form className="grid gap-4" onSubmit={confirmOtp}>
            <div className="grid gap-2">
              <Label htmlFor="otp">One-time code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                required
              />
              {devCode && (
                <p className="text-xs text-muted-foreground">
                  Dev code: <span className="font-mono text-foreground">{devCode}</span>
                </p>
              )}
            </div>
            <Button type="submit" disabled={busy || code.trim().length < 4}>
              Verify & continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setDevCode(null);
              }}
            >
              Use a different email
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
