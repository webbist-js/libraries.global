import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * Bordered pill eyebrow for page heroes.
 * Renders: [icon] [children] [accent?]
 *
 * @param icon     Leading glyph — defaults to ★
 * @param accent   Optional trailing span in T.accent.aurora (e.g. "· v2.1")
 */
export function HeroEyebrow({
  children,
  icon = "★",
  accent,
}: {
  readonly children: ReactNode
  readonly icon?: string
  readonly accent?: string
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "5px 11px",
        borderRadius: "999px",
        fontSize: "10px",
        border: `1px solid ${T.border.line}`,
        background: "rgba(255,255,255,.03)",
        fontFamily: T.font.mono,
        letterSpacing: ".22em",
        color: T.ink.dim,
        textTransform: "uppercase",
        marginBottom: "22px",
      }}
    >
      <span>{icon}</span>
      <span>{children}</span>
      {accent ? <span style={{ color: T.accent.aurora }}>{accent}</span> : null}
    </div>
  )
}
