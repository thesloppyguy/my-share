import { ReactNode } from "react";
import {
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
} from "@/components/ui/grouped-form";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  green: "bg-mac-green text-white",
  red: "bg-mac-red text-white",
  purple: "bg-mac-purple text-white",
  blue: "bg-mac-blue text-white",
  pink: "bg-mac-pink text-white",
  gray: "bg-mac-gray text-white",
};

type SettingsRowProps = {
  icon?: ReactNode;
  iconTone?: keyof typeof toneClass | string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
};

export function SettingsRow({
  icon,
  iconTone = "gray",
  title,
  subtitle,
  trailing,
  className,
}: SettingsRowProps) {
  return (
    <GroupedFormRow className={className}>
      {icon && (
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-[6px] [&_svg]:size-3.5",
            toneClass[iconTone] ?? toneClass.gray,
          )}
        >
          {icon}
        </div>
      )}
      <GroupedFormRowLabel className="flex-1">
        <GroupedFormRowTitle>{title}</GroupedFormRowTitle>
        {subtitle && (
          <GroupedFormRowDescription>{subtitle}</GroupedFormRowDescription>
        )}
      </GroupedFormRowLabel>
      {trailing && (
        <GroupedFormRowControl>{trailing}</GroupedFormRowControl>
      )}
    </GroupedFormRow>
  );
}
