import { ReactNode } from "react";
import {
  Clipboard,
  Ellipsis,
  FolderKanban,
  Laptop,
  Settings2,
  UserRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTab } from "@/types";
import { cn } from "@/lib/utils";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "general", label: "General", icon: <Settings2 /> },
  { id: "profile", label: "Profile", icon: <UserRound /> },
  { id: "clipboard", label: "Clipboard", icon: <Clipboard /> },
  { id: "watch", label: "Watch List", icon: <FolderKanban /> },
  { id: "devices", label: "Devices", icon: <Laptop /> },
  { id: "others", label: "Others", icon: <Ellipsis /> },
];

type SettingsShellProps = {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: ReactNode;
  error?: string | null;
};

export function SettingsShell({
  activeTab,
  onTabChange,
  children,
  error,
}: SettingsShellProps) {
  return (
    <div className="mt-6 flex h-full flex-col bg-mac-window px-4 text-mac-label">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as SettingsTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="mx-2 mt-2 grid h-auto w-auto grid-cols-6 gap-0.5"
        >
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "h-auto flex-col gap-1 rounded-[8px] px-1 py-2 text-mac-caption font-medium",
                "data-active:bg-mac-accent/15 data-active:text-mac-accent data-active:after:opacity-0",
              )}
            >
              <span className="[&_svg]:size-4">{tab.icon}</span>
              <span className="leading-none">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {error && (
          <div className="px-3 pt-2">
            <div className="rounded-[8px] bg-mac-red/10 px-3 py-2 text-mac-subheadline text-mac-red">
              {error}
            </div>
          </div>
        )}

        <TabsContent
          value={activeTab}
          className="mt-5 min-h-0 flex-1 overflow-auto px-3 pt-3 pb-4 outline-none"
        >
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}
