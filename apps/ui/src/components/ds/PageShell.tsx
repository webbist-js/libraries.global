import type { CSSProperties, ReactNode } from "react"

import { AURORA_BG, GRAIN_SVG, T } from "@/lib/design-tokens"

export function PageShell({
  children,
  className,
  style,
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate", // creates stacking context so aurora/grain z-indexes are local
        minHeight: "100vh",
        background: T.bg.void,
        color: T.ink.base,
        fontFamily: T.font.sans,
        WebkitFontSmoothing: "antialiased",
        ...style,
      }}
      className={className}
    >
      {/* Aurora field — negative z-index so all content (even non-positioned) renders above it */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          pointerEvents: "none",
          background: AURORA_BG,
        }}
      />
      {/* Film grain */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          opacity: 0.35,
          mixBlendMode: "screen",
          backgroundImage: GRAIN_SVG,
        }}
      />
      {/* Content — display:contents passes layout through to PageShell */}
      <div style={{ display: "contents" }}>{children}</div>
    </div>
  )
}
