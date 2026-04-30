"use client"

import type React from "react"

import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

interface ContributeHeroShellProps {
  children: React.ReactNode
  minHeight?: string
  overlay?: React.CSSProperties["background"]
}

/**
 * Shared hero shell for all /contribute pages.
 * Renders the DotHeroCanvas background, fade overlay, and a transparent-header
 * section that slides behind the 56px sticky global header.
 *
 * Content is placed in `children` — use a relative z-10 div inside.
 */
export function ContributeHeroShell({
  children,
  minHeight,
  overlay = "linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.6) 100%)",
}: ContributeHeroShellProps) {
  return (
    <section
      data-transparent-header=""
      className="-mt-14 overflow-hidden"
      style={{
        position: "relative",
        background: T.bg.void,
        borderBottom: `1px solid ${T.border.line}`,
        ...(minHeight ? { minHeight } : {}),
      }}
    >
      <DotHeroCanvas />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: overlay }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1296px] px-6 pt-28 pb-10 md:px-10">
        {children}
      </div>
    </section>
  )
}
