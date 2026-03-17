import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 bg-transparent border-0 border-b-2 border-dashed border-foreground/40 px-0 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-b-2 focus-visible:border-solid focus-visible:border-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
