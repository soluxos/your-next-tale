import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-departureMono uppercase whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - High emphasis, main call-to-action
        primary:
          "bg-[#1f1f1f] text-white shadow-sm hover:bg-[#484848] hover:shadow-lg active:bg-[#2a2a2a]",
        // Secondary - Medium emphasis, outlined style
        secondary:
          "border-2 border-[#1f1f1f] bg-transparent text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white active:bg-[#2d2d2d]",
        // Tertiary - Low emphasis, ghost style
        tertiary:
          "bg-transparent text-[#565656] hover:bg-[#f0f0f0] hover:text-[#1f1f1f] active:bg-[#e5e5e5]",
        // Keep legacy variants for backwards compatibility
        default:
          "bg-[#1f1f1f] text-primary-foreground shadow hover:bg-[#353535]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-[#565656] underline-offset-4 hover:underline hover:text-[#1f1f1f]"
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-sm",
        xl: "h-14 rounded-md px-10 text-sm",
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
