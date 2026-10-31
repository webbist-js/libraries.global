import type React from "react"
import type { ControllerFieldState } from "react-hook-form"

import { FormLabel } from "@/components/ui/form"
import { cn } from "@/lib/styles"

type Props = {
  readonly label?: React.ReactNode
  readonly fieldState?: ControllerFieldState
  readonly required?: boolean
  readonly className?: string
  readonly htmlFor?: string
}

export function AppFormLabel({
  fieldState,
  label,
  required,
  className,
  htmlFor,
}: Props) {
  if (label == null) {
    return null
  }

  return (
    <FormLabel
      {...(htmlFor ? { htmlFor } : {})}
      className={cn(
        {
          "font-normal": !fieldState?.invalid,
          "font-medium": fieldState?.invalid,
        },
        className
      )}
    >
      {label}
      {required && (
        <span aria-hidden="true" className="text-(--t-accent-danger)">
          *
        </span>
      )}
    </FormLabel>
  )
}
