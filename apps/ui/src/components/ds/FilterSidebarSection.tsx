import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

interface FilterSidebarSectionProps {
  readonly index: number
  readonly label: string
  readonly children: ReactNode
}

export function FilterSidebarSection({
  index,
  label,
  children,
}: FilterSidebarSectionProps) {
  const prefix = `§ ${String(index).padStart(2, "0")} ·`

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.ghost,
          }}
        >
          {prefix}
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
