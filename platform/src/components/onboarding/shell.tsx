import { ReactNode } from "react";
import { useNativeWindowControls } from "@/app/window-controls";
import {
  Window,
  WindowContent,
  WindowControls,
  WindowTitle,
  WindowTitlebar,
} from "@/components/ui/window";
import { cn } from "@/lib/utils";

type OnboardingShellProps = {
  title: string;
  children: ReactNode;
  contentClassName?: string;
};

export function OnboardingShell({
  title,
  children,
  contentClassName,
}: OnboardingShellProps) {
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
        <WindowTitle data-tauri-drag-region>{title}</WindowTitle>
      </WindowTitlebar>
      <WindowContent
        className={cn(
          "mx-auto flex w-full max-w-[460px] flex-col wrap-break-word px-9 pt-7 pb-6",
          contentClassName,
        )}
      >
        {children}
      </WindowContent>
    </Window>
  );
}
