"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md bg-bg-elevated border border-border pl-3 pr-10 py-1 font-sans text-sm text-text-primary placeholder:text-text-dim transition-colors focus:border-accent-cyan focus:outline-none focus:shadow-glow disabled:opacity-50",
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center rounded-md text-text-dim hover:text-text-secondary"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
