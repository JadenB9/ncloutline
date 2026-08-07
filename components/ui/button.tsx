import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-cyan text-white hover:bg-[#6E9AF2] active:bg-[#4A7BDB] shadow-hard",
        green:
          "bg-accent-green text-white hover:bg-[#54C69A] active:bg-[#3AA57B] shadow-hard",
        outline:
          "bg-transparent text-text-primary border border-border hover:border-border-strong hover:bg-bg-elevated",
        ghost:
          "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated",
        danger:
          "bg-transparent text-accent-red border border-border hover:border-accent-red hover:bg-accent-red/10",
      },
      size: {
        sm: "h-7 px-2 text-xs",
        md: "h-9 px-3",
        lg: "h-11 px-4",
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
