import { Download, Folder, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { AppSnapshot } from "@/types";

type OthersTabProps = {
  snapshot: AppSnapshot;
};

export function OthersTab({ snapshot }: OthersTabProps) {
  return (
    <div className="grid gap-3">
      <SettingsGroup>
        <SettingsRow
          icon={<Download />}
          iconTone="gray"
          title={`my-share ${snapshot.local_device.app_version}`}
          subtitle={`Device ${snapshot.local_device.name}`}
          trailing={<Badge variant="secondary">Installed</Badge>}
        />
        <SettingsRow
          icon={<Folder />}
          iconTone="blue"
          title="Local Store"
          subtitle={snapshot.store_path}
        />
        <SettingsRow
          icon={<Info />}
          iconTone="green"
          title="Clipboard History"
          subtitle={`${snapshot.clipboard_count} saved entries`}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={<Info />}
          iconTone="purple"
          title="Registry"
          subtitle={`${snapshot.registry.device_count} devices · ${snapshot.registry.peer_count} peers · ${snapshot.registry.connection_count} connections`}
        />
      </SettingsGroup>
    </div>
  );
}
