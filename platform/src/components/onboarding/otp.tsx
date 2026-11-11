import { FormEvent, useState } from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { OnboardingShell } from "./shell";

type OtpStepProps = {
  email: string;
  busy?: boolean;
  error?: string | null;
  onVerify: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onBack: () => void;
};

export function OtpStep({
  email,
  busy = false,
  error,
  onVerify,
  onResend,
  onBack,
}: OtpStepProps) {
  const [code, setCode] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length < 6) return;
    await onVerify(code.trim());
  }

  return (
    <OnboardingShell
      title="Verify Your Email"
      contentClassName="max-w-[380px] items-center px-8 pt-8"
    >
      <IconTile size="lg" className="size-16 rounded-[16px] [&_svg]:size-8">
        <MailIcon />
      </IconTile>
      <div className="flex flex-col gap-1">
        <h2 className="text-center text-mac-title-2 font-bold text-mac-label">
          Check your inbox
        </h2>
        <p className="text-center text-mac-body text-mac-label-secondary">
          We sent a code to {email}. It works for 10 minutes.
        </p>
      </div>
      <form
        className="flex w-full flex-1 flex-col items-center gap-4"
        onSubmit={handleSubmit}
      >
        <InputOTP
          length={6}
          value={code}
          onValueChange={setCode}
          disabled={busy}
          required
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        {error && (
          <p className="text-center text-mac-subheadline text-mac-red">
            {error}
          </p>
        )}
        <div className="mt-auto flex w-full flex-col items-center gap-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || code.trim().length < 6}
          >
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <div className="flex flex-row items-center gap-1">
            <p className="text-mac-subheadline text-mac-label-secondary">
              Nothing yet?
            </p>
            <Button
              type="button"
              variant="link"
              disabled={busy}
              onClick={() => void onResend()}
            >
              Send Again
            </Button>
          </div>
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={onBack}
          >
            Use a different email
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}

export default OtpStep;
