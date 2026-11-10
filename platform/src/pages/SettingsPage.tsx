import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { SettingsShell } from "@/components/SettingsShell";
import { ClipboardTab } from "@/components/tabs/ClipboardTab";
import { DevicesTab } from "@/components/tabs/DevicesTab";
import { GeneralTab } from "@/components/tabs/GeneralTab";
import { OthersTab } from "@/components/tabs/OthersTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { WatchListTab } from "@/components/tabs/WatchListTab";
import {
  AppSnapshot,
  ClipboardSettings,
  Settings,
  SettingsTab,
  WatchSettings,
  WatchedFolder,
} from "@/types";

type SettingsPageProps = {
  snapshot: AppSnapshot;
  onSnapshot: (snapshot: AppSnapshot) => void;
  onLogout: () => Promise<void>;
};

export function SettingsPage({
  snapshot,
  onSnapshot,
  onLogout,
}: SettingsPageProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [error, setError] = useState<string | null>(null);

  async function apply(action: () => Promise<AppSnapshot>) {
    try {
      const next = await action();
      onSnapshot(next);
      setError(null);
    } catch (err) {
      setError(String(err));
      throw err;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SettingsShell activeTab={tab} onTabChange={setTab} error={error}>
          {tab === "general" && (
            <GeneralTab
              settings={snapshot.settings}
              onChange={(settings: Settings) => {
                onSnapshot({ ...snapshot, settings });
                void apply(() =>
                  invoke<AppSnapshot>("update_general_settings", { settings }),
                );
              }}
            />
          )}

          {tab === "profile" && (
            <ProfileTab
              profile={snapshot.profile}
              onSave={async ({ name, email }) => {
                await apply(() =>
                  invoke<AppSnapshot>("update_profile", {
                    args: { name, email },
                  }),
                );
              }}
            />
          )}

          {tab === "clipboard" && (
            <ClipboardTab
              clipboard={snapshot.clipboard}
              historyCount={snapshot.clipboard_count}
              onChange={(clipboard: ClipboardSettings) => {
                onSnapshot({ ...snapshot, clipboard });
                void apply(() =>
                  invoke<AppSnapshot>("update_clipboard_settings", {
                    clipboard,
                  }),
                );
              }}
            />
          )}

          {tab === "watch" && (
            <WatchListTab
              watch={snapshot.watch}
              folders={snapshot.watched_folders}
              onChange={(watch: WatchSettings, folders: WatchedFolder[]) => {
                onSnapshot({
                  ...snapshot,
                  watch,
                  watched_folders: folders,
                });
                void apply(() =>
                  invoke<AppSnapshot>("update_watch_settings", {
                    args: { watch, folders },
                  }),
                );
              }}
            />
          )}

          {tab === "devices" && (
            <DevicesTab
              snapshot={snapshot}
              onRenameLocal={async (name) => {
                await apply(() =>
                  invoke<AppSnapshot>("rename_local_device", {
                    args: { name },
                  }),
                );
              }}
              onRegisterPeer={async (peerId, multiaddr) => {
                await apply(() =>
                  invoke<AppSnapshot>("register_peer", {
                    args: {
                      peerId,
                      multiaddr,
                      linkLocalDevice: false,
                    },
                  }),
                );
              }}
            />
          )}

          {tab === "others" && <OthersTab snapshot={snapshot} />}
        </SettingsShell>
      </div>

      <div className="border-t border-border/50 px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void onLogout()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
