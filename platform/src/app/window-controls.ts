import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useNativeWindowControls() {
  const [inactive, setInactive] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisteners: Array<() => void> = [];

    void (async () => {
      try {
        setMaximized(await appWindow.isMaximized());
        setInactive(!(await appWindow.isFocused()));

        unlisteners.push(
          await appWindow.onFocusChanged(({ payload: focused }) => {
            setInactive(!focused);
          }),
        );
        unlisteners.push(
          await appWindow.onResized(async () => {
            setMaximized(await appWindow.isMaximized());
          }),
        );
      } catch {
        // Browser preview outside Tauri — keep defaults.
      }
    })();

    return () => {
      for (const unlisten of unlisteners) unlisten();
    };
  }, []);

  return {
    inactive,
    maximized,
    onClose: () => {
      void getCurrentWindow().close();
    },
    onMinimize: () => {
      void getCurrentWindow().minimize();
    },
    onZoom: () => {
      void getCurrentWindow().toggleMaximize();
    },
  };
}
