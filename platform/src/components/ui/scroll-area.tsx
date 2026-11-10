"use client"

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

// A scrolling region with macOS overlay scrollers: thin and hidden until
// you scroll, wider with a track while the pointer is on them.
function ScrollArea({ className, children, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] outline-none focus-visible:mac-focus-ring"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({ className, orientation = "vertical", ...props }: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "group/scrollbar flex touch-none p-[2px] opacity-0 transition-[opacity,background-color,width,height] duration-300 select-none data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0",
        "data-[orientation=vertical]:w-[11px] data-[orientation=horizontal]:h-[11px] data-[orientation=horizontal]:flex-col",
        "hover:bg-black/4 hover:data-[orientation=vertical]:w-[15px] hover:data-[orientation=horizontal]:h-[15px] dark:hover:bg-white/6",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-black/40 transition-colors group-hover/scrollbar:bg-black/55 dark:bg-white/40 dark:group-hover/scrollbar:bg-white/55"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
