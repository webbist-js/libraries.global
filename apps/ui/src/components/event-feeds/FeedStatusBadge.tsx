import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import { feedStatusOf } from "./feed-copy"
import type { FeedView } from "./types"

const TONES = {
  ok: { bg: "var(--tint-public-bg)", fg: T.accent.ok },
  info: { bg: T.accent.chip, fg: T.accent.primaryHover },
  warn: { bg: "#F5EEDC", fg: "#6B5420" },
} as const

/** A feed's status as a tinted pill: icon plus label, never colour alone. */
export function FeedStatusBadge({ feed }: { readonly feed: FeedView }) {
  const status = feedStatusOf(feed)
  const { bg, fg } = TONES[status.tone]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{ background: bg, color: fg, fontFamily: T.font.sans }}
    >
      <Icon icon={status.icon} width={15} height={15} aria-hidden="true" />
      {status.label}
    </span>
  )
}
