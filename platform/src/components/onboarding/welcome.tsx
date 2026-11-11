import { FormEvent, useState } from "react";
import {
  CloudIcon,
  LayoutGridIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingShell } from "./shell";

type WelcomeStepProps = {
  email: string;
  busy?: boolean;
  error?: string | null;
  onEmailChange: (email: string) => void;
  onContinue: (email: string) => void | Promise<void>;
};

export function WelcomeStep({
  email,
  busy = false,
  error,
  onEmailChange,
  onContinue,
}: WelcomeStepProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = email.trim();
    if (!next.includes("@")) {
      setLocalError("Enter a valid email address");
      return;
    }
    setLocalError(null);
    await onContinue(next);
  }

  const message = localError ?? error;

  return (
    <OnboardingShell title="Welcome">
      <div className="flex flex-col items-center gap-4">
        <IconTile
          color="indigo"
          size="lg"
          className="size-16 shrink-0 rounded-[16px] [&_svg]:size-8"
        >
          <SparklesIcon />
        </IconTile>
        <div className="flex shrink-0 flex-col gap-1">
          <h1 className="text-center text-mac-title-1 font-bold text-mac-label">
            Welcome to my-share
          </h1>
          <p className="text-center text-mac-body text-mac-label-secondary">
            Clipboard, folders, and devices — synced across your own machines.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3">
          <div className="flex flex-row items-center gap-3">
            <IconTile size="lg">
              <LayoutGridIcon />
            </IconTile>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-mac-body font-medium text-mac-label">
                See everything at a glance
              </p>
              <p className="text-mac-subheadline text-mac-label-secondary">
                Clipboard history and watched folders in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
            <IconTile color="green" size="lg">
              <UsersIcon />
            </IconTile>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-mac-body font-medium text-mac-label">
                Link your devices
              </p>
              <p className="text-mac-subheadline text-mac-label-secondary">
                Sign in once and your Macs and phones share the same space.
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
            <IconTile color="teal" size="lg">
              <CloudIcon />
            </IconTile>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-mac-body font-medium text-mac-label">
                Pick up anywhere
              </p>
              <p className="text-mac-subheadline text-mac-label-secondary">
                Content moves peer-to-peer between your devices.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form
        className="mt-auto flex w-full shrink-0 flex-col gap-3 pt-6"
        onSubmit={handleSubmit}
      >
        <div className="flex w-full flex-col gap-1.5">
          <Label htmlFor="work-email">Email</Label>
          <Input
            type="email"
            placeholder="you@example.com"
            id="work-email"
            name="work-email"
            autoFocus
            autoComplete="email"
            value={email}
            disabled={busy}
            onChange={(event) => onEmailChange(event.target.value)}
            required
          />
        </div>
        {message && (
          <p className="w-full text-left text-mac-subheadline text-mac-red">
            {message}
          </p>
        )}
        <p className="text-mac-subheadline text-mac-label-secondary">
          We'll send a code to check that the email is yours.
        </p>
        <div className="flex w-full flex-row justify-end gap-2">
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Continue"}
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}

export default WelcomeStep;
