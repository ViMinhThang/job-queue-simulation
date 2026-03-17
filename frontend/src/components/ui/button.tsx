"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-handwritten text-base transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-2 border-foreground hover:rotate-0 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none shadow-[3px_3px_0_var(--foreground)]",
        outline:
          "bg-transparent border-2 border-foreground text-foreground hover:bg-secondary hover:rotate-0 hover:translate-x-0.5 hover:translate-y-0.5 shadow-[2px_2px_0_var(--foreground)]",
        secondary:
          "bg-secondary text-secondary-foreground border-2 border-foreground hover:bg-muted hover:rotate-0 hover:translate-x-0.5 hover:translate-y-0.5 shadow-[2px_2px_0_var(--foreground)]",
        ghost:
          "bg-transparent border border-foreground/30 hover:bg-muted hover:border-foreground",
        destructive:
          "bg-destructive text-destructive-foreground border-2 border-destructive hover:bg-destructive/80 shadow-[3px_3px_0_var(--destructive)]",
        link: "text-primary underline-offset-4 hover:underline border-none shadow-none",
      },
      size: {
        default:
          "h-10 px-4 py-1 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        xs: "h-6 px-2 text-xs rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        sm: "h-8 px-3 text-sm rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        lg: "h-12 px-6 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        icon: "size-10 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        "icon-xs":
          "size-6 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        "icon-sm":
          "size-8 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
        "icon-lg": "size-12 rounded-[255px_15px_225px_15px/15px_225px_15px_255px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
