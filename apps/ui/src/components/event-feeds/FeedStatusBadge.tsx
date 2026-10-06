import { Icon } from "@iconify/react"

import { NOTICE_TONES } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { feedStatusOf } from "./feed-copy"
import type { FeedView } from "./types"

/** A feed's status as a tinted pill: icon plus label, never colour alone. */
export function FeedStatusBadge({ feed }: { readonly feed: FeedView }) {
  const status = feedStatusOf(feed)
  const { bg, fg } = NOTICE_TONES[status.tone]

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
