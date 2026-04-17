import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full bg-bg-panel border border-border px-3 py-1 font-mono text-sm text-text-primary placeholder:text-text-dim focus:border-accent-cyan focus:outline-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
