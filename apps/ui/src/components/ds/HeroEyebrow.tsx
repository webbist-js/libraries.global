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
  icon: _icon,
  accent,
}: {
  readonly children: ReactNode
  readonly icon?: string
  readonly accent?: string
}) {
  // v2: sentence-case sans pill. `icon` glyphs are retired (accepted for API
  // compatibility); a small indigo dot leads instead.
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        borderRadius: "999px",
        fontSize: "14px",
        fontWeight: 600,
        border: `1px solid ${T.border.line}`,
        background: T.bg.deep,
        fontFamily: T.font.sans,
        color: T.ink.dim,
        marginBottom: "22px",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "999px",
          background: T.accent.primary,
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
      {accent ? (
        <span style={{ color: T.accent.primary }}>{accent}</span>
      ) : null}
    </div>
  )
}
