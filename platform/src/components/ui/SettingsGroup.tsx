import { ReactNode } from "react";
import { GroupedFormGroup } from "@/components/ui/grouped-form";
import { cn } from "@/lib/utils";

type SettingsGroupProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SettingsGroup({
  children,
  className,
  contentClassName,
}: SettingsGroupProps) {
  return (
    <GroupedFormGroup className={cn(className, contentClassName)}>
      {children}
    </GroupedFormGroup>
  );
}
