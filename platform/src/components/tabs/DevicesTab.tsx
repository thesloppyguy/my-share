import { FormEvent, useState } from "react";
import { Laptop, Smartphone, Tablet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { AppSnapshot, Hardware } from "@/types";

type DevicesTabProps = {
  snapshot: AppSnapshot;
  onRenameLocal: (name: string) => Promise<void>;
  onRegisterPeer: (peerId: string, multiaddr: string | null) => Promise<void>;
};

function hardwareIcon(hardware: Hardware) {
  switch (hardware) {
    case "phone":
      return <Smartphone className="size-4" />;
    case "tablet":
      return <Tablet className="size-4" />;
    default:
      return <Laptop className="size-4" />;
  }
}

function hardwareLabel(hardware: Hardware): string {
  switch (hardware) {
    case "phone":
      return "Phone";
    case "tablet":
      return "Tablet";
    case "computer":
      return "Computer";
    default:
      return "Device";
  }
}

export function DevicesTab({
  snapshot,
  onRenameLocal,
  onRegisterPeer,
}: DevicesTabProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [peerId, setPeerId] = useState("");
  const [multiaddr, setMultiaddr] = useState("");
  const [busy, setBusy] = useState(false);

  const devices = snapshot.registry.devices.length
    ? snapshot.registry.devices
    : [
        {
          id: snapshot.local_device.id,
          name: snapshot.local_device.name,
          hardware: snapshot.local_device.hardware,
          platform: snapshot.local_device.platform,
          app_version: snapshot.local_device.app_version,
          peer_ids: [],
          status: "Offline",
          connection_count: 0,
        },
      ];

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onRenameLocal(name.trim());
      setRenamingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function submitPeer(event: FormEvent) {
    event.preventDefault();
    if (!peerId.trim()) return;
    setBusy(true);
    try {
      await onRegisterPeer(peerId.trim(), multiaddr.trim() || null);
      setPeerId("");
      setMultiaddr("");
      setSetupOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <SettingsGroup>
        {devices.map((device) => {
          const isLocal = device.id === snapshot.local_device.id;
          return (
            <div
              key={device.id}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                {hardwareIcon(device.hardware)}
              </div>
              <div className="min-w-0 flex-1">
                {renamingId === device.id ? (
                  <form className="flex gap-2" onSubmit={saveRename}>
                    <Input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      Save
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="text-sm font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isLocal
                        ? "This computer"
                        : `${hardwareLabel(device.hardware)} · ${device.status}`}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLocal && renamingId !== device.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRenamingId(device.id);
                      setName(device.name);
                    }}
                  >
                    Rename
                  </Button>
                )}
                {!isLocal && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Remove coming soon"
                    disabled
                  >
                    <X />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </SettingsGroup>

      {setupOpen ? (
        <SettingsGroup contentClassName="grid gap-3 p-3">
          <div className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Set Up Another Device
          </div>
          <form className="grid gap-3" onSubmit={submitPeer}>
            <div className="grid gap-1.5">
              <Label htmlFor="peer-id">Peer ID</Label>
              <Input
                id="peer-id"
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                placeholder="12D3KooW…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="multiaddr">Multiaddr (optional)</Label>
              <Input
                id="multiaddr"
                value={multiaddr}
                onChange={(e) => setMultiaddr(e.target.value)}
                placeholder="/ip4/192.168.1.10/tcp/4001"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                Register Peer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setSetupOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SettingsGroup>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full"
          onClick={() => setSetupOpen(true)}
        >
          Set Up Another Device…
        </Button>
      )}
    </div>
  );
}
