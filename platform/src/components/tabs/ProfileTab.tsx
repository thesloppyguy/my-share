import { FormEvent, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { Profile } from "@/types";

type ProfileTabProps = {
  profile: Profile;
  onSave: (profile: { name: string; email: string }) => Promise<void>;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfileTab({ profile, onSave }: ProfileTabProps) {
  const [editing, setEditing] = useState<"name" | "email" | null>(null);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ name: name.trim(), email: email.trim() });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <SettingsGroup contentClassName="flex flex-col items-center gap-4 p-5 text-center">
        <div className="relative">
          <Avatar className="size-20 text-2xl">
            <AvatarFallback>
              {initials(profile.name || "User")}
            </AvatarFallback>
          </Avatar>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute right-0 bottom-0 rounded-full"
            title="Avatar coming soon"
            disabled
          >
            <Camera />
          </Button>
        </div>

        <div>
          <div className="text-xl font-semibold">
            {profile.name || "Your name"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {profile.email || "Add an email"}
          </div>
        </div>

        {editing ? (
          <form className="grid w-full max-w-[260px] gap-2" onSubmit={submit}>
            <Input
              autoFocus
              value={editing === "name" ? name : email}
              onChange={(e) =>
                editing === "name"
                  ? setName(e.target.value)
                  : setEmail(e.target.value)
              }
              placeholder={editing === "name" ? "Display name" : "Email"}
            />
            <div className="flex justify-center gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setName(profile.name);
                  setEmail(profile.email);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setName(profile.name);
                setEditing("name");
              }}
            >
              Edit Name
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setEmail(profile.email);
                setEditing("email");
              }}
            >
              Edit Email
            </Button>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}
