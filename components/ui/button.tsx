import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-mono text-sm font-medium uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-cyan text-bg-deep hover:bg-[#33EBFF] active:bg-[#00B8CC] border border-accent-cyan",
        green:
          "bg-accent-green text-bg-deep hover:bg-[#33FFA3] active:bg-[#00CC6D] border border-accent-green",
        outline:
          "bg-transparent text-text-primary border border-border hover:border-accent-cyan hover:text-accent-cyan",
        ghost:
          "bg-transparent text-text-secondary hover:text-accent-cyan hover:bg-bg-elevated",
        danger:
          "bg-transparent text-accent-red border border-accent-red hover:bg-accent-red hover:text-bg-deep",
      },
      size: {
        sm: "h-7 px-2 text-xs",
        md: "h-9 px-3",
        lg: "h-11 px-4 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...rest }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...rest}
      />
    );
  }
);
Button.displayName = "Button";
