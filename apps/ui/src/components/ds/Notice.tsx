import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"

/** The [bg, fg] pair for each status tone. Reused wherever a tinted status
 * pill or line needs the same colours as a Notice (e.g. FeedStatusBadge,
 * EventFeedPanel) rather than re-declaring them. */
export const TONES = {
  ok: { bg: TYPE_TINT.public.bg, fg: T.accent.ok },
  info: { bg: T.accent.chip, fg: T.accent.primaryHover },
  warn: { bg: "#F5EEDC", fg: T.accent.warn },
} as const

export type NoticeTone = keyof typeof TONES

/** A tinted notice with an icon: status is never colour alone. */
export function Notice({
  icon,
  tone,
  title,
  children,
}: {
  /** Iconify id, e.g. "mdi:check-circle-outline". */
  readonly icon: string
  readonly tone: NoticeTone
  readonly title: string
  readonly children?: ReactNode
}) {
  const { bg, fg } = TONES[tone]

  return (
    <div
      className="flex items-start gap-3 rounded-[16px] px-4 py-3.5"
      style={{ background: bg }}
    >
      <Icon
        aria-hidden="true"
        icon={icon}
        width={20}
        height={20}
        className="mt-0.5 shrink-0"
        style={{ color: fg }}
      />
      <div className="flex min-w-0 flex-col gap-1 text-base leading-[1.55]">
        <p className="m-0 font-semibold" style={{ color: fg }}>
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}
