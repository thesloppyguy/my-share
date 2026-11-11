import { invoke } from "@tauri-apps/api/core";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { AppShell } from "@/components/AppShell";
import { ClipboardPage } from "@/pages/ClipboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SharePage } from "@/pages/SharePage";
import { WatchPage } from "@/pages/WatchPage";
import type { AppRoute, AppSnapshot, WatchSettings, WatchedFolder } from "@/types";
import { useSnapshot } from "./snapshot";

const ROUTE_TITLES: Record<AppRoute, string> = {
  clipboard: "Clipboard",
  watch: "Watch List",
  share: "Share",
  settings: "Settings",
};

function routeFromPath(pathname: string): AppRoute {
  const segment = pathname.replace(/^\//, "").split("/")[0];
  if (
    segment === "clipboard" ||
    segment === "watch" ||
    segment === "share" ||
    segment === "settings"
  ) {
    return segment;
  }
  return "clipboard";
}

function LoadingScreen({ error }: { error: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-mac-window text-mac-label">
      <p className="text-mac-body text-mac-label-secondary">Loading…</p>
      {error && (
        <p className="max-w-sm px-4 text-center text-mac-subheadline text-mac-red">
          {error}
        </p>
      )}
    </div>
  );
}

function LoginRoute() {
  const { snapshot, error, setSnapshot } = useSnapshot();
  const navigate = useNavigate();

  if (!snapshot) {
    return <LoadingScreen error={error} />;
  }

  if (snapshot.authenticated) {
    return <Navigate to="/clipboard" replace />;
  }

  return (
    <LoginPage
      onAuthenticated={(next: AppSnapshot) => {
        setSnapshot(next);
        void navigate("/clipboard", { replace: true });
      }}
    />
  );
}

function AuthenticatedLayout() {
  const { snapshot, error } = useSnapshot();
  const location = useLocation();

  if (!snapshot) {
    return <LoadingScreen error={error} />;
  }

  if (!snapshot.authenticated) {
    return <Navigate to="/login" replace />;
  }

  const route = routeFromPath(location.pathname);

  return (
    <AppShell title={ROUTE_TITLES[route]}>
      <Outlet />
    </AppShell>
  );
}

function ClipboardRoute() {
  const { snapshot } = useSnapshot();
  if (!snapshot) return null;
  return <ClipboardPage snapshot={snapshot} />;
}

function WatchRoute() {
  const { snapshot, setSnapshot, applySnapshot, setError } = useSnapshot();
  if (!snapshot) return null;

  return (
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
  );
}

function ShareRoute() {
  const { snapshot, applySnapshot } = useSnapshot();
  if (!snapshot) return null;

  return (
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
  );
}

function SettingsRoute() {
  const { snapshot, setSnapshot } = useSnapshot();
  if (!snapshot) return null;

  return (
    <SettingsPage
      snapshot={snapshot}
      onSnapshot={setSnapshot}
      onLogout={async () => {
        const next = await invoke<AppSnapshot>("logout");
        setSnapshot(next);
      }}
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<AuthenticatedLayout />}>
        <Route index element={<Navigate to="/clipboard" replace />} />
        <Route path="clipboard" element={<ClipboardRoute />} />
        <Route path="watch" element={<WatchRoute />} />
        <Route path="share" element={<ShareRoute />} />
        <Route path="settings" element={<SettingsRoute />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
