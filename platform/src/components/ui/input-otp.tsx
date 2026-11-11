import * as React from "react"
import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field"
import { MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// A verification code field: one box per character, built on Base UI's
// OTP Field. Typing moves to the next box; pasting fills them all.
function InputOTP({ className, ...props }: OTPFieldPrimitive.Root.Props) {
  return (
    <OTPFieldPrimitive.Root
      data-slot="input-otp"
      className={cn("flex items-center gap-2 has-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("flex items-center gap-1.5", className)} {...props} />
}

function InputOTPSlot({
  index,
  className,
  ...props
}: OTPFieldPrimitive.Input.Props & {
  index?: number
}) {
  return (
    <OTPFieldPrimitive.Input
      data-slot="input-otp-slot"
      aria-label={index !== undefined && index > 0 ? `Character ${index + 1}` : undefined}
      className={cn(
        "h-9 w-8 rounded-[7px] bg-mac-field text-center text-[17px] font-semibold text-mac-label caret-mac-accent shadow-[0_0_0_1px_var(--mac-field-border)] transition-[box-shadow] outline-none",
        "focus:shadow-[0_0_0_1px_var(--mac-field-border),0_0_0_3.5px_color-mix(in_srgb,var(--mac-accent)_50%,transparent)] aria-invalid:shadow-[0_0_0_3.5px_color-mix(in_srgb,var(--mac-red)_50%,transparent)] disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" className="text-mac-label-tertiary" {...props}>
      <MinusIcon className="size-3.5" strokeWidth={2.5} />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
