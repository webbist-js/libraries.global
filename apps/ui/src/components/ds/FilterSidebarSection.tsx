"use client"

import { Icon } from "@iconify/react"
import { type ReactNode, useState } from "react"

import { T } from "@/lib/design-tokens"

interface FilterSidebarSectionProps {
  readonly index: number
  readonly label: string
  readonly children: ReactNode
  readonly collapsible?: boolean
  readonly defaultOpen?: boolean
}

export function FilterSidebarSection({
  index,
  label,
  children,
  collapsible = false,
  defaultOpen,
}: FilterSidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? !collapsible)
  const prefix = `§ ${String(index).padStart(2, "0")} ·`

  return (
    <div>
      <button
        type="button"
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          marginBottom: open ? "10px" : 0,
          cursor: collapsible ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            {prefix}
          </span>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.low,
            }}
          >
            {label}
          </span>
        </div>
        {collapsible && (
          <Icon
            icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
            style={{ color: T.ink.faint, fontSize: "14px", flexShrink: 0 }}
          />
        )}
      </button>
      {open && children}
    </div>
  )
}
