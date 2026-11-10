import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "@/components/AppShell";
import { ClipboardPage } from "@/pages/ClipboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SharePage } from "@/pages/SharePage";
import { WatchPage } from "@/pages/WatchPage";
import {
  AppRoute,
  AppSnapshot,
  WatchSettings,
  WatchedFolder,
} from "@/types";

const ROUTE_TITLES: Record<AppRoute, string> = {
  clipboard: "Clipboard",
  watch: "Watch List",
  share: "Share",
  settings: "Settings",
};

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [route, setRoute] = useState<AppRoute>("clipboard");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await invoke<AppSnapshot>("get_snapshot");
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function applySnapshot(action: () => Promise<AppSnapshot>) {
    const next = await action();
    setSnapshot(next);
    setError(null);
    return next;
  }

  if (!snapshot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
        {error && (
          <p className="max-w-sm px-4 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!snapshot.authenticated) {
    return (
      <LoginPage
        onAuthenticated={(next) => {
          setSnapshot(next);
          setRoute("clipboard");
        }}
      />
    );
  }

  return (
    <AppShell
      route={route}
      onRouteChange={setRoute}
      title={ROUTE_TITLES[route]}
    >
      {route === "clipboard" && <ClipboardPage snapshot={snapshot} />}

      {route === "watch" && (
        <WatchPage
          snapshot={snapshot}
          onChange={(watch: WatchSettings, folders: WatchedFolder[]) => {
            setSnapshot({
              ...snapshot,
              watch,
              watched_folders: folders,
            });
            void applySnapshot(() =>
              invoke<AppSnapshot>("update_watch_settings", {
                args: { watch, folders },
              }),
            ).catch((err) => setError(String(err)));
          }}
        />
      )}

      {route === "share" && (
        <SharePage
          snapshot={snapshot}
          onRegisterPeer={async (peerId, multiaddr) => {
            await applySnapshot(() =>
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

      {route === "settings" && (
        <SettingsPage
          snapshot={snapshot}
          onSnapshot={setSnapshot}
          onLogout={async () => {
            const next = await invoke<AppSnapshot>("logout");
            setSnapshot(next);
          }}
        />
      )}
    </AppShell>
  );
}

export default App;
