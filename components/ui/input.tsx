import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md bg-bg-elevated border border-border px-3 py-1 font-sans text-sm text-text-primary placeholder:text-text-dim transition-colors focus:border-accent-cyan focus:outline-none focus:shadow-glow disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
