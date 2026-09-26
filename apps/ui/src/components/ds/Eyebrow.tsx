import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function Eyebrow({
  children,
  index: _index,
  bar,
}: {
  readonly children: ReactNode
  readonly index?: number
  readonly bar?: boolean
}) {
  // v2: quiet sans section label — the mono-uppercase eyebrow is retired.
  // `index` is accepted for API compatibility but no longer rendered.
  return (
    <p
      style={{
        fontFamily: T.font.sans,
        fontSize: "14px",
        fontWeight: 600,
        color: T.ink.dim,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: 0,
      }}
    >
      {bar && (
        <span
          style={{
            width: "28px",
            height: "2px",
            borderRadius: "999px",
            background: T.accent.primary,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </p>
  )
}
