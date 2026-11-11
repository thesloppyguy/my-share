import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSnapshot } from "@/types";

type SnapshotContextValue = {
  snapshot: AppSnapshot | null;
  error: string | null;
  setSnapshot: (snapshot: AppSnapshot) => void;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
  applySnapshot: (action: () => Promise<AppSnapshot>) => Promise<AppSnapshot>;
};

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
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

  const applySnapshot = useCallback(
    async (action: () => Promise<AppSnapshot>) => {
      const next = await action();
      setSnapshot(next);
      setError(null);
      return next;
    },
    [],
  );

  const value = useMemo(
    () => ({
      snapshot,
      error,
      setSnapshot,
      setError,
      refresh,
      applySnapshot,
    }),
    [snapshot, error, refresh, applySnapshot],
  );

  return (
    <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) {
    throw new Error("useSnapshot must be used within SnapshotProvider");
  }
  return ctx;
}
