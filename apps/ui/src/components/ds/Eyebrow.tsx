import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function Eyebrow({
  children,
  index,
  bar,
}: {
  readonly children: ReactNode
  readonly index?: number
  readonly bar?: boolean
}) {
  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".22em",
        textTransform: "uppercase",
        color: T.ink.faint,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: 0,
      }}
    >
      {bar && (
        <span
          style={{
            width: "40px",
            height: "1px",
            background: T.ink.ghost,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {index != null ? `§ ${String(index).padStart(2, "0")} · ` : null}
      {children}
    </p>
  )
}
