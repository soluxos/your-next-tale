import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Mirrors the .btn system in globals.css so shadcn-based screens match the rest of the site.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-departureMono uppercase tracking-[0.02em] whitespace-nowrap rounded-[8px] text-[11px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-[#383838] active:bg-black",
        secondary: "border border-line bg-white text-ink hover:bg-paper-2 hover:border-[#c9c9c9]",
        tertiary: "bg-transparent text-textSecondary hover:bg-paper-3 hover:text-ink",
        default: "bg-ink text-white hover:bg-[#383838] active:bg-black",
        destructive: "bg-[#b42318] text-white hover:bg-[#912018]",
        outline: "border border-line bg-white text-ink hover:bg-paper-2 hover:border-[#c9c9c9]",
        ghost: "bg-transparent text-textSecondary hover:bg-paper-3 hover:text-ink",
        link: "text-textSecondary underline-offset-4 hover:underline hover:text-ink"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-12 px-6",
        xl: "h-14 px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default"
    }
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
