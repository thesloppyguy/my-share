import { FormEvent, useState } from "react";
import { Clipboard, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { ClipboardSettings } from "@/types";

type ClipboardTabProps = {
  clipboard: ClipboardSettings;
  historyCount: number;
  onChange: (next: ClipboardSettings) => void;
};

export function ClipboardTab({
  clipboard,
  historyCount,
  onChange,
}: ClipboardTabProps) {
  const [appName, setAppName] = useState("");

  function addApp(event: FormEvent) {
    event.preventDefault();
    const name = appName.trim();
    if (!name) return;
    if (clipboard.disabled_applications.includes(name)) {
      setAppName("");
      return;
    }
    onChange({
      ...clipboard,
      disabled_applications: [...clipboard.disabled_applications, name],
    });
    setAppName("");
  }

  return (
    <div className="grid gap-3">
      <SettingsGroup>
        <SettingsRow
          icon={<Clipboard />}
          iconTone="blue"
          title="Clipboard Sync"
          subtitle={`${historyCount} items in history`}
          trailing={
            <Switch
              size="mini"
              checked={clipboard.enabled}
              onCheckedChange={(enabled) => onChange({ ...clipboard, enabled })}
              aria-label="Clipboard Sync"
            />
          }
        />
        <SettingsRow
          icon={<span className="text-[10px] font-bold">Aa</span>}
          iconTone="purple"
          title="Text Recognition"
          subtitle="OCR on incoming images when supported"
          trailing={
            <Switch
              size="mini"
              checked={clipboard.text_recognition}
              onCheckedChange={(text_recognition) =>
                onChange({ ...clipboard, text_recognition })
              }
              aria-label="Text Recognition"
            />
          }
        />
        <SettingsRow
          icon={<span className="text-[10px] font-bold">#</span>}
          iconTone="gray"
          title="History Limit"
          trailing={
            <Input
              className="h-7 w-16 text-right text-xs"
              type="number"
              min={0}
              value={clipboard.history_limit}
              onChange={(e) =>
                onChange({
                  ...clipboard,
                  history_limit: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <div className="px-3 pt-3 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          Disabled Applications
        </div>
        {clipboard.disabled_applications.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            No apps excluded from clipboard sync.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {clipboard.disabled_applications.map((app) => (
              <Badge key={app} variant="secondary" className="gap-1 pr-1">
                {app}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Remove ${app}`}
                  onClick={() =>
                    onChange({
                      ...clipboard,
                      disabled_applications:
                        clipboard.disabled_applications.filter(
                          (item) => item !== app,
                        ),
                    })
                  }
                >
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        <form className="flex gap-2 border-t border-border/60 p-3" onSubmit={addApp}>
          <Input
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="App name or bundle ID"
          />
          <Button type="submit" size="sm" variant="secondary">
            Add
          </Button>
        </form>
      </SettingsGroup>
    </div>
  );
}
