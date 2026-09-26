import type React from "react"

import { T } from "@/lib/design-tokens"

interface ContributeHeroShellProps {
  children: React.ReactNode
  minHeight?: string
  /** @deprecated pre-v2 wash — ignored. */
  overlay?: React.CSSProperties["background"]
}

/**
 * Shared hero band for all /contribute pages — the v2 tinted band pattern
 * (deeper paper, hairline border below), matching the Docs/Events heroes.
 */
export function ContributeHeroShell({
  children,
  minHeight,
}: ContributeHeroShellProps) {
  return (
    <section
      style={{
        position: "relative",
        background: T.bg.space,
        borderBottom: `1px solid ${T.border.line}`,
        ...(minHeight ? { minHeight } : {}),
      }}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8 md:py-14">
        {children}
      </div>
    </section>
  )
}
