import { Clipboard, FolderKanban, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { OnboardingShell } from "./shell";

type CompleteStepProps = {
  onContinue: () => void;
};

export function CompleteStep({ onContinue }: CompleteStepProps) {
  return (
    <OnboardingShell
      title="You're All Set"
      contentClassName="max-w-[400px] px-6 py-6"
    >
      <h2 className="text-mac-title-2 font-bold text-mac-label">
        Three good first steps
      </h2>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center gap-3">
          <IconTile>
            <Clipboard />
          </IconTile>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-mac-body font-medium text-mac-label">
              Check your clipboard
            </p>
            <p className="text-mac-subheadline text-mac-label-secondary">
              Recent copies show up here automatically.
            </p>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3">
          <IconTile color="green">
            <FolderKanban />
          </IconTile>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-mac-body font-medium text-mac-label">
              Watch a folder
            </p>
            <p className="text-mac-subheadline text-mac-label-secondary">
              Keep a directory in sync across devices.
            </p>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3">
          <IconTile color="orange">
            <Share2 />
          </IconTile>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-mac-body font-medium text-mac-label">
              Link another device
            </p>
            <p className="text-mac-subheadline text-mac-label-secondary">
              Sign in with the same email to share.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-row justify-end gap-2 pt-6">
        <Button onClick={onContinue}>Open my-share</Button>
      </div>
    </OnboardingShell>
  );
}

export default CompleteStep;
