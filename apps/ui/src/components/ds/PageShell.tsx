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
        minHeight: "100vh",
        background: T.bg.void,
        color: T.ink.base,
        overflowX: "hidden",
        fontFamily: T.font.sans,
        WebkitFontSmoothing: "antialiased",
        ...style,
      }}
      className={className}
    >
      {/* Aurora field */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
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
          zIndex: 1,
          pointerEvents: "none",
          opacity: 0.35,
          mixBlendMode: "screen",
          backgroundImage: GRAIN_SVG,
        }}
      />
      {/* Content */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  )
}
