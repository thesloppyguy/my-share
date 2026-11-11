import { ReactNode } from "react";
import { NavLink } from "react-router";
import { Clipboard, FolderKanban, Settings2, Share2 } from "lucide-react";
import { useNativeWindowControls } from "@/app/window-controls";
import {
  Window,
  WindowContent,
  WindowControls,
  WindowTitle,
  WindowTitlebar,
} from "@/components/ui/window";
import { cn } from "@/lib/utils";
import { AppRoute } from "@/types";

const NAV: { id: AppRoute; label: string; icon: ReactNode; to: string }[] = [
  { id: "clipboard", label: "Clipboard", icon: <Clipboard />, to: "/clipboard" },
  { id: "watch", label: "Watch List", icon: <FolderKanban />, to: "/watch" },
  { id: "share", label: "Share", icon: <Share2 />, to: "/share" },
  { id: "settings", label: "Settings", icon: <Settings2 />, to: "/settings" },
];

type AppShellProps = {
  title?: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const { inactive, maximized, onClose, onMinimize, onZoom } =
    useNativeWindowControls();

  return (
    <Window
      className={cn("h-full w-full", maximized && "rounded-none shadow-none")}
      inactive={inactive}
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
    >
      <WindowTitlebar data-tauri-drag-region>
        <WindowControls />
        <WindowTitle data-tauri-drag-region>
          {title ?? "my-share"}
        </WindowTitle>
      </WindowTitlebar>

      <WindowContent className="min-h-0 flex-1 overflow-hidden">
        {children}
      </WindowContent>

      <nav className="mac-material-dock grid shrink-0 grid-cols-4 border-t border-mac-separator px-1 pb-2 pt-1">
        {NAV.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 rounded-[8px] px-2 py-2 text-mac-caption font-medium transition-colors",
                isActive
                  ? "bg-mac-accent/15 text-mac-accent"
                  : "text-mac-label-secondary hover:text-mac-label",
              )
            }
          >
            <span className="[&_svg]:size-4">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </Window>
  );
}
