import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import type { DriveTag } from "./submissionMeta"

/**
 * "Drives with work waiting": a chip per open Drive with pending tagged
 * submissions, linking into the queue filtered to it. Renders nothing when
 * there's nothing waiting (spec §7.1).
 */
export function DriveQueueStrip({
  rows,
}: {
  readonly rows: { drive: DriveTag; waiting: number }[]
}) {
  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-(--t-palette-mint-bg) bg-(--t-palette-mint-soft) p-5">
      <h2
        className="m-0 font-serif text-[24px] leading-tight tracking-tight"
        style={{ color: T.ink.base }}
      >
        Drives with work waiting
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {rows.map(({ drive, waiting }) => (
          <li key={drive.documentId}>
            <Link
              href={`/contribute/moderation?category=libraries&drive=${encodeURIComponent(drive.documentId)}&status=pending`}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-muted2)"
              style={{
                border: `1px solid ${T.border.hi}`,
                background: T.bg.surface,
                color: T.ink.base,
              }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:pin-outline"
                width={16}
                height={16}
                style={{ color: T.accent.primary }}
              />
              {`${drive.title} · ${waiting} waiting`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
