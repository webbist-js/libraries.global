import type { ReactNode } from "react"

import Emphasis from "@/components/home/Emphasis"
import type { SectionIntro } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** v2 homepage section heading — serif title (with `*accent*` support), an
 * optional supporting line, and an optional right-aligned action. */
export function SectionHeader({
  intro,
  action,
  id,
}: {
  readonly intro: SectionIntro
  readonly action?: ReactNode
  readonly id?: string
}) {
  if (!intro.title) return null

  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2
          id={id}
          className="m-0 text-balance"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(34px,4vw,50px)",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          <Emphasis text={intro.title} emStyle={{ color: T.accent.primary }} />
        </h2>
        {intro.text ? (
          <p
            className="mt-2 max-w-[600px] text-[18px] leading-[1.55] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {intro.text}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

SectionHeader.displayName = "SectionHeader"

export default SectionHeader
