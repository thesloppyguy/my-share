import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The small rounded-square icon used in System Settings and similar lists:
// a white symbol on a colored tile.
const iconTileVariants = cva(
  "inline-flex shrink-0 items-center justify-center bg-linear-to-b from-white/12 to-black/4 text-white shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      color: {
        blue: "bg-mac-blue",
        gray: "bg-mac-gray",
        graphite: "bg-[#5d5d62]",
        green: "bg-mac-green",
        indigo: "bg-mac-indigo",
        orange: "bg-mac-orange",
        pink: "bg-mac-pink",
        purple: "bg-mac-purple",
        red: "bg-mac-red",
        teal: "bg-mac-teal",
        yellow: "bg-mac-yellow",
        black: "bg-[#1c1c1e] shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.2)]",
        white: "bg-white text-mac-label shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.15)]",
      },
      size: {
        sm: "size-4 rounded-[4px] [&_svg:not([class*='size-'])]:size-2.5",
        default: "size-5 rounded-[5px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "size-8 rounded-[8px] [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      color: "blue",
      size: "default",
    },
  }
)

function IconTile({
  className,
  color,
  size,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> &
  VariantProps<typeof iconTileVariants>) {
  return (
    <span
      data-slot="icon-tile"
      className={cn(iconTileVariants({ color, size }), className)}
      {...props}
    />
  )
}

export { IconTile, iconTileVariants }
