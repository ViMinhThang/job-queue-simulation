"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 border-dashed data-horizontal:h-px data-horizontal:w-full data-horizontal:border-t-2 data-vertical:w-px data-vertical:self-stretch data-vertical:border-l-2",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
