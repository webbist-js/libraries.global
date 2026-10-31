"use client"

import type { ComponentProps } from "react"

import {
  DROPDOWN_PANEL,
  DROPDOWN_SELECT_POSITION,
} from "@/components/ds/dropdown-styles"
import {
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SelectContent, SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/styles"

type TriggerProps =
  | ({ kind: "menu" } & ComponentProps<typeof DropdownMenuTrigger>)
  | ({ kind: "popover" } & ComponentProps<typeof PopoverTrigger>)
  | ({ kind: "select" } & ComponentProps<typeof SelectTrigger>)

type ContentProps =
  | ({ kind: "menu" } & ComponentProps<typeof DropdownMenuContent>)
  | ({ kind: "popover" } & ComponentProps<typeof PopoverContent>)
  | ({ kind: "select" } & ComponentProps<typeof SelectContent>)

const TRIGGER_HEIGHT =
  "h-[44px] min-h-[44px] data-[size=default]:h-[44px] data-[size=sm]:h-[44px]"

const POSITION = {
  align: "end",
  side: "bottom",
  sideOffset: 12,
  collisionPadding: 16,
} as const

/** Equal trigger heights keep every header panel on the same opening line. */
export function HeaderDropdownTrigger({
  kind,
  className,
  ...props
}: TriggerProps) {
  const classes = cn(className, TRIGGER_HEIGHT)
  if (kind === "select") return <SelectTrigger {...props} className={classes} />
  if (kind === "popover")
    return <PopoverTrigger {...props} className={classes} />

  return <DropdownMenuTrigger {...props} className={classes} />
}

/** One panel shell; each primitive retains its own selection and focus semantics. */
export function HeaderDropdownContent(props: ContentProps) {
  if (props.kind === "select") {
    const { kind: _kind, className, ...content } = props

    return (
      <SelectContent
        {...content}
        {...POSITION}
        position="popper"
        className={cn(DROPDOWN_PANEL, DROPDOWN_SELECT_POSITION, className)}
      />
    )
  }
  if (props.kind === "popover") {
    const { kind: _kind, className, ...content } = props

    return (
      <PopoverContent
        {...POSITION}
        {...content}
        className={cn(
          DROPDOWN_PANEL,
          "z-[70] max-h-(--radix-popover-content-available-height)",
          className
        )}
      />
    )
  }
  const { kind: _kind, className, ...content } = props

  return (
    <DropdownMenuContent
      {...content}
      {...POSITION}
      className={cn(DROPDOWN_PANEL, "z-[70]", className)}
    />
  )
}
