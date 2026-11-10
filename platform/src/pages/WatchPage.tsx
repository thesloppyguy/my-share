import { FormEvent, useState } from "react";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AppSnapshot, WatchSettings, WatchedFolder } from "@/types";

type WatchPageProps = {
  snapshot: AppSnapshot;
  onChange: (watch: WatchSettings, folders: WatchedFolder[]) => void;
};

export function WatchPage({ snapshot, onChange }: WatchPageProps) {
  const [folderPath, setFolderPath] = useState("");
  const folders = snapshot.watched_folders;
  const watch = snapshot.watch;

  function addFolder(event: FormEvent) {
    event.preventDefault();
    const path = folderPath.trim();
    if (!path || folders.some((f) => f.path === path)) {
      setFolderPath("");
      return;
    }
    onChange(watch, [...folders, { path, recursive: true, enabled: true }]);
    setFolderPath("");
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Watch List</h2>
          <p className="text-xs text-muted-foreground">
            Folders marked for sync and monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Watching</span>
          <Switch
            checked={watch.enabled}
            onCheckedChange={(enabled) => onChange({ ...watch, enabled }, folders)}
            aria-label="Enable folder watching"
          />
        </div>
      </div>

      <div className="mb-3 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {folders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No folders marked for sync yet.
          </p>
        ) : (
          folders.map((folder) => (
            <div
              key={folder.path}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-white">
                <Folder className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{folder.path}</p>
                <p className="text-xs text-muted-foreground">
                  {folder.recursive ? "Recursive" : "This folder only"}
                </p>
              </div>
              <Switch
                checked={folder.enabled}
                onCheckedChange={(enabled) =>
                  onChange(
                    watch,
                    folders.map((f) =>
                      f.path === folder.path ? { ...f, enabled } : f,
                    ),
                  )
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange(
                    watch,
                    folders.filter((f) => f.path !== folder.path),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      <form className="flex gap-2" onSubmit={addFolder}>
        <Input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="/path/to/folder"
        />
        <Button type="submit" variant="secondary">
          Add folder
        </Button>
      </form>
    </div>
  );
}
