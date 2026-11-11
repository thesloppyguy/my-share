import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CompleteStep } from "@/components/onboarding/complete";
import { OtpStep } from "@/components/onboarding/otp";
import { WelcomeStep } from "@/components/onboarding/welcome";
import { AppSnapshot, OtpChallenge } from "@/types";

type LoginStep = "welcome" | "otp" | "complete";

type LoginPageProps = {
  onAuthenticated: (snapshot: AppSnapshot) => void;
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>("welcome");
  const [email, setEmail] = useState("");
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(nextEmail: string) {
    setBusy(true);
    setError(null);
    try {
      const challenge = await invoke<OtpChallenge>("request_otp", {
        args: { email: nextEmail.trim() },
      });
      setEmail(challenge.email);
      setStep("otp");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp(code: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await invoke<AppSnapshot>("verify_otp", {
        args: { email: email.trim(), code: code.trim() },
      });
      setSnapshot(next);
      setStep("complete");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {step === "welcome" && (
        <WelcomeStep
          email={email}
          busy={busy}
          error={error}
          onEmailChange={setEmail}
          onContinue={sendOtp}
        />
      )}

      {step === "otp" && (
        <OtpStep
          email={email}
          busy={busy}
          error={error}
          onVerify={confirmOtp}
          onResend={() => sendOtp(email)}
          onBack={() => {
            setStep("welcome");
            setError(null);
          }}
        />
      )}

      {step === "complete" && snapshot && (
        <CompleteStep onContinue={() => onAuthenticated(snapshot)} />
      )}
    </>
  );
}
