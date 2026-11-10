import { FormEvent, useState } from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSnapshot, Hardware } from "@/types";

type SharePageProps = {
  snapshot: AppSnapshot;
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

export function SharePage({ snapshot, onRegisterPeer }: SharePageProps) {
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
          peer_ids: [] as string[],
          status: "Offline",
          connection_count: 0,
        },
      ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!peerId.trim()) return;
    setBusy(true);
    try {
      await onRegisterPeer(peerId.trim(), multiaddr.trim() || null);
      setPeerId("");
      setMultiaddr("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Share</h2>
        <p className="text-xs text-muted-foreground">
          Send between your account devices and linked peers
        </p>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {devices.map((device) => {
          const isLocal = device.id === snapshot.local_device.id;
          return (
            <div
              key={device.id}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-violet-500 text-white">
                {hardwareIcon(device.hardware)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{device.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isLocal ? "This device" : device.status}
                  {device.peer_ids.length
                    ? ` · ${device.peer_ids.length} peer id(s)`
                    : ""}
                </p>
              </div>
              <Badge variant={device.connection_count > 0 ? "default" : "secondary"}>
                {device.connection_count > 0 ? "Online" : "Offline"}
              </Badge>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Link another device</h3>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="share-peer">Peer ID</Label>
            <Input
              id="share-peer"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="12D3KooW…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="share-addr">Multiaddr (optional)</Label>
            <Input
              id="share-addr"
              value={multiaddr}
              onChange={(e) => setMultiaddr(e.target.value)}
              placeholder="/ip4/192.168.1.10/tcp/4001"
            />
          </div>
          <Button type="submit" disabled={busy || !peerId.trim()}>
            Register peer
          </Button>
        </form>
      </div>
    </div>
  );
}
