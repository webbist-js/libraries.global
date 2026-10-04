import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

const TONES = {
  ok: { bg: "var(--tint-public-bg)", fg: T.accent.ok },
  info: { bg: T.accent.chip, fg: T.accent.primaryHover },
  warn: { bg: "#F5EEDC", fg: "#6B5420" },
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
      <div className="flex min-w-0 flex-col gap-1 text-[15px] leading-[1.55]">
        <p className="m-0 font-semibold" style={{ color: fg }}>
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}
