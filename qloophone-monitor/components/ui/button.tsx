import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent2 text-white hover:bg-accent2/90 hover:shadow-[0_0_20px_var(--clr-accent2)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_0_20px_var(--destructive)]",
        outline:
          "border border-white/20 bg-transparent hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_15px_var(--clr-accent1)]",
        secondary:
          "bg-white/10 text-secondary-foreground hover:bg-white/20 hover:shadow-[0_0_15px_var(--clr-accent3)]",
        ghost: "hover:bg-white/10 hover:text-accent-foreground",
        link: "text-accent1 underline-offset-4 hover:underline hover:text-accent2",
        accent1: "bg-accent1 text-white hover:bg-accent1/90 hover:shadow-[0_0_20px_var(--clr-accent1)]",
        accent3: "bg-accent3 text-black hover:bg-accent3/90 hover:shadow-[0_0_20px_var(--clr-accent3)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
