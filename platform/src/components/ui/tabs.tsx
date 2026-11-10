import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-3 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

// `default` is a macOS tabs; `line` is a plain text tab bar.
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-mac-label group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "rounded-[6px] bg-mac-control p-0.5 group-data-[orientation=horizontal]/tabs:h-6",
        line: "gap-4 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 cursor-default items-center justify-center gap-1 px-2.5 text-mac-body font-medium whitespace-nowrap text-mac-label select-none outline-none focus-visible:mac-focus-ring data-disabled:pointer-events-none data-disabled:text-mac-label-tertiary group-data-[orientation=vertical]/tabs:h-5 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        // Tabs: the selected segment is filled with the accent color.
        "group-data-[variant=default]/tabs-list:rounded-[5px] group-data-[variant=default]/tabs-list:data-active:bg-mac-accent group-data-[variant=default]/tabs-list:data-active:text-white group-data-[inactive]/window:group-data-[variant=default]/tabs-list:data-active:bg-mac-fill-primary group-data-[inactive]/window:group-data-[variant=default]/tabs-list:data-active:text-mac-label",
        // Thin dividers between unselected segments
        "group-data-[variant=default]/tabs-list:not-first:before:absolute group-data-[variant=default]/tabs-list:not-first:before:top-1/2 group-data-[variant=default]/tabs-list:not-first:before:left-0 group-data-[variant=default]/tabs-list:not-first:before:h-3.5 group-data-[variant=default]/tabs-list:not-first:before:w-px group-data-[variant=default]/tabs-list:not-first:before:-translate-y-1/2 group-data-[variant=default]/tabs-list:not-first:before:bg-mac-label-tertiary group-data-[variant=default]/tabs-list:data-active:before:hidden group-data-[variant=default]/tabs-list:[[data-active]+&]:before:hidden",
        // Line tabs
        "group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:pb-1 group-data-[variant=line]/tabs-list:text-mac-label-secondary group-data-[variant=line]/tabs-list:hover:text-mac-label group-data-[variant=line]/tabs-list:data-active:text-mac-label",
        "after:absolute after:bg-mac-accent after:opacity-0 group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-0 group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
