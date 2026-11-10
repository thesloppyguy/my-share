import { FormEvent, useState } from "react";
import { Folder, FolderKanban, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { WatchSettings, WatchedFolder } from "@/types";

type WatchListTabProps = {
  watch: WatchSettings;
  folders: WatchedFolder[];
  onChange: (watch: WatchSettings, folders: WatchedFolder[]) => void;
};

export function WatchListTab({ watch, folders, onChange }: WatchListTabProps) {
  const [ignoredName, setIgnoredName] = useState("");
  const [folderPath, setFolderPath] = useState("");

  function addIgnored(event: FormEvent) {
    event.preventDefault();
    const name = ignoredName.trim();
    if (!name || watch.ignored.includes(name)) {
      setIgnoredName("");
      return;
    }
    onChange({ ...watch, ignored: [...watch.ignored, name] }, folders);
    setIgnoredName("");
  }

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
    <div className="grid gap-3">
      <SettingsGroup>
        <SettingsRow
          icon={<FolderKanban />}
          iconTone="green"
          title="Folder Watching"
          subtitle="Watch folders for changes to share"
          trailing={
            <Switch
              size="mini"
              checked={watch.enabled}
              onCheckedChange={(enabled) =>
                onChange({ ...watch, enabled }, folders)
              }
              aria-label="Folder Watching"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <div className="px-3 pt-3 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          Ignored Directory Names
        </div>
        {watch.ignored.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            No ignored names.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {watch.ignored.map((name) => (
              <Badge key={name} variant="secondary" className="gap-1 pr-1">
                {name}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Remove ${name}`}
                  onClick={() =>
                    onChange(
                      {
                        ...watch,
                        ignored: watch.ignored.filter((item) => item !== name),
                      },
                      folders,
                    )
                  }
                >
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 border-t border-border/60 p-3"
          onSubmit={addIgnored}
        >
          <Input
            value={ignoredName}
            onChange={(e) => setIgnoredName(e.target.value)}
            placeholder="e.g. node_modules"
          />
          <Button type="submit" size="sm" variant="secondary">
            Add
          </Button>
        </form>
      </SettingsGroup>

      <SettingsGroup>
        <div className="px-3 pt-3 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          Watched Folders
        </div>
        {folders.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            No folders watched yet.
          </p>
        ) : (
          folders.map((folder) => (
            <SettingsRow
              key={folder.path}
              icon={<Folder />}
              iconTone="blue"
              title={folder.path}
              subtitle={folder.recursive ? "Recursive" : "This folder only"}
              trailing={
                <div className="flex items-center gap-2">
                  <Switch
                    size="mini"
                    checked={folder.enabled}
                    onCheckedChange={(enabled) =>
                      onChange(
                        watch,
                        folders.map((f) =>
                          f.path === folder.path ? { ...f, enabled } : f,
                        ),
                      )
                    }
                    aria-label={`Enable ${folder.path}`}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${folder.path}`}
                    onClick={() =>
                      onChange(
                        watch,
                        folders.filter((f) => f.path !== folder.path),
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              }
            />
          ))
        )}
        <form
          className="flex gap-2 border-t border-border/60 p-3"
          onSubmit={addFolder}
        >
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/folder"
          />
          <Button type="submit" size="sm" variant="secondary">
            Add
          </Button>
        </form>
      </SettingsGroup>
    </div>
  );
}
