import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent2/20 text-accent2 hover:bg-accent2/30 hover:shadow-[0_0_10px_var(--clr-accent2)]",
        secondary:
          "border-transparent bg-white/10 text-secondary-foreground hover:bg-white/20",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-white/20 hover:border-white/30",
        accent1:
          "border-transparent bg-accent1/20 text-accent1 hover:bg-accent1/30 hover:shadow-[0_0_10px_var(--clr-accent1)]",
        accent3:
          "border-transparent bg-accent3/20 text-accent3 hover:bg-accent3/30 hover:shadow-[0_0_10px_var(--clr-accent3)]",
        success:
          "border-transparent bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:shadow-[0_0_10px_rgba(34,197,94,0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
