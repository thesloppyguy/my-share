import { ReactNode } from "react";
import { Clipboard, FolderKanban, Settings2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppRoute } from "@/types";

const NAV: { id: AppRoute; label: string; icon: ReactNode }[] = [
  { id: "clipboard", label: "Clipboard", icon: <Clipboard /> },
  { id: "watch", label: "Watch List", icon: <FolderKanban /> },
  { id: "share", label: "Share", icon: <Share2 /> },
  { id: "settings", label: "Settings", icon: <Settings2 /> },
];

type AppShellProps = {
  route: AppRoute;
  onRouteChange: (route: AppRoute) => void;
  title?: string;
  children: ReactNode;
};

export function AppShell({
  route,
  onRouteChange,
  title,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-full flex-col bg-mac-window text-mac-label">
      <header className="mac-material-titlebar flex h-11 shrink-0 items-center justify-center border-b border-mac-separator px-4">
        <h1 className="text-mac-headline font-semibold tracking-tight">
          {title ?? "my-share"}
        </h1>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

      <nav className="mac-material-dock grid shrink-0 grid-cols-4 border-t border-mac-separator px-1 pb-2 pt-1">
        {NAV.map((item) => {
          const active = route === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onRouteChange(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[8px] px-2 py-2 text-mac-caption font-medium transition-colors",
                active
                  ? "bg-mac-accent/15 text-mac-accent"
                  : "text-mac-label-secondary hover:text-mac-label",
              )}
            >
              <span className="[&_svg]:size-4">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
