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
            "flex h-9 w-full bg-bg-panel border border-border pl-3 pr-9 py-1 font-mono text-sm text-text-primary placeholder:text-text-dim focus:border-accent-cyan focus:outline-none disabled:opacity-50",
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-text-dim hover:text-accent-cyan"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
