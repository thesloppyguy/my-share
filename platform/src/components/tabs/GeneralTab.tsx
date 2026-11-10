import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Settings } from "@/types";
import {
  Check,
  Download,
  Folder,
  Image,
  Power,
  Upload,
  Volume2,
} from "lucide-react";

type GeneralTabProps = {
  settings: Settings;
  onChange: (next: Settings) => void;
};

function limitLabel(mb: number): string {
  return mb === 0 ? "No Limit" : `${mb} MB`;
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  return (
    <div className="grid gap-3">
      <SettingsGroup>
        <SettingsRow
          icon={<Power />}
          iconTone="green"
          title="Launch at Login"
          trailing={
            <Switch
              size="mini"
              checked={settings.launch_on_login}
              onCheckedChange={(launch_on_login) =>
                onChange({ ...settings, launch_on_login })
              }
              aria-label="Launch at Login"
            />
          }
        />
        <SettingsRow
          icon={<Volume2 />}
          iconTone="red"
          title="Play Sound Effects"
          trailing={
            <Switch
              size="mini"
              checked={settings.play_sound}
              onCheckedChange={(play_sound) =>
                onChange({ ...settings, play_sound })
              }
              aria-label="Play Sound Effects"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={<Check />}
          iconTone="purple"
          title="Auto-Accept"
          trailing={
            <Select
              value={settings.auto_accept}
              items={{
                never: "Never",
                my_devices: "From My Devices",
                all_devices: "All Devices",
              }}
              onValueChange={(auto_accept) => {
                if (!auto_accept) return;
                onChange({
                  ...settings,
                  auto_accept: auto_accept as Settings["auto_accept"],
                });
              }}
            >
              <SelectTrigger size="sm" variant="borderless" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="my_devices">From My Devices</SelectItem>
                <SelectItem value="all_devices">All Devices</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsRow
          icon={<Folder />}
          iconTone="blue"
          title="Save Files to"
          trailing={
            <Input
              className="h-7 w-[140px] text-xs"
              value={settings.save_path}
              placeholder="Choose a folder…"
              onChange={(e) =>
                onChange({ ...settings, save_path: e.target.value })
              }
              onBlur={(e) =>
                onChange({ ...settings, save_path: e.target.value.trim() })
              }
            />
          }
        />
        <SettingsRow
          icon={<Image />}
          iconTone="pink"
          title="Send from Photo Library"
          subtitle="Save incoming photos to gallery when supported"
          trailing={
            <Switch
              size="mini"
              checked={settings.save_photos_to_gallery}
              onCheckedChange={(save_photos_to_gallery) =>
                onChange({ ...settings, save_photos_to_gallery })
              }
              aria-label="Send from Photo Library"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={<Upload />}
          iconTone="gray"
          title="Sending Speed Limit"
          trailing={
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-16 text-right text-xs"
                type="number"
                min={0}
                value={settings.upload_limit_mb}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    upload_limit_mb: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <span className="text-mac-subheadline text-mac-label-secondary">
                {limitLabel(settings.upload_limit_mb)}
              </span>
            </div>
          }
        />
        <SettingsRow
          icon={<Download />}
          iconTone="gray"
          title="Receiving Speed Limit"
          trailing={
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-16 text-right text-xs"
                type="number"
                min={0}
                value={settings.download_limit_mb}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    download_limit_mb: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <span className="text-mac-subheadline text-mac-label-secondary">
                {limitLabel(settings.download_limit_mb)}
              </span>
            </div>
          }
        />
      </SettingsGroup>
    </div>
  );
}
