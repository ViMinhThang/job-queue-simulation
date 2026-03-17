import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 px-2 py-0.5 text-sm font-semibold transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-2 border-foreground rounded-[2px_8px_2px_6px]",
        secondary:
          "bg-secondary text-secondary-foreground border-2 border-foreground/60 rounded-[2px_8px_2px_6px]",
        destructive:
          "bg-destructive text-white border-2 border-destructive rounded-[2px_8px_2px_6px]",
        outline:
          "bg-transparent border-2 border-dashed border-foreground/50 text-foreground rounded-[2px_8px_2px_6px]",
        ghost:
          "bg-transparent border border-foreground/30 text-foreground/70 rounded-[2px_6px_2px_4px]",
        link: "text-primary underline-offset-4 hover:underline border-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
