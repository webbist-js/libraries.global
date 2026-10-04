import type { ReactNode } from "react"

import Emphasis from "@/components/home/Emphasis"
import {
  type DisplaySize,
  displayStyle,
} from "@/components/home/homepage.constants"
import type { SectionIntro } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** v2 homepage section heading: a display serif title (with `*accent*`
 * support), an optional supporting line, and an optional action set on the
 * title's baseline at the right. `textBeside` moves the supporting line to
 * the right-hand column instead. */
export function SectionHeader({
  intro,
  action,
  id,
  size = "section",
  textBeside = false,
}: {
  readonly intro: SectionIntro
  readonly action?: ReactNode
  readonly id?: string
  readonly size?: DisplaySize
  readonly textBeside?: boolean
}) {
  if (!intro.title) return null

  const text = intro.text ? (
    <p
      className={`m-0 max-w-[520px] text-pretty ${
        textBeside
          ? "text-[16px] leading-[1.6]"
          : "mt-4 text-[18px] leading-[1.6]"
      }`}
      style={{ color: T.ink.dim }}
    >
      {intro.text}
    </p>
  ) : null

  return (
    <div
      className={`mb-8 flex flex-wrap justify-between gap-x-10 gap-y-4 ${
        textBeside ? "items-start" : "items-end"
      }`}
    >
      <div className="min-w-0">
        <h2
          id={id}
          className="m-0 text-balance"
          style={{ ...displayStyle(size), color: T.ink.base }}
        >
          <Emphasis text={intro.title} emStyle={{ color: T.accent.primary }} />
        </h2>
        {textBeside ? null : text}
      </div>
      {textBeside ? <div className="max-w-[480px] pt-2">{text}</div> : null}
      {action ? <div className="pb-2">{action}</div> : null}
    </div>
  )
}

SectionHeader.displayName = "SectionHeader"

export default SectionHeader
