import { Icon } from "@iconify/react"

import { StatCard } from "@/components/ds/StatCard"
import { T, TYPE_TINT } from "@/lib/design-tokens"

import { earnedProLine, type PendingQuota, quotaLine } from "./task-panel.logic"

/** `GET /api/drives/[slug]/mine`: the reader's own counts for a drive. */
export type DriveMine = { sent: number; inReview: number; accepted: number }

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * "Your part" in a drive: what the reader sent for it, what's still in
 * review and what was accepted (their Drive Credits), then their pending
 * quota ("3 of 5 waiting for review") and, below Archivist, how far drive
 * work has to go to earned Pro. Signed-in readers only.
 */
export function DriveYourPart({
  mine,
  quota,
  toArchivist,
}: {
  /** Null while loading. */
  readonly mine: DriveMine | null
  readonly quota: PendingQuota | null
  /** Points to Archivist, or null at it or above (or unknown). */
  readonly toArchivist: number | null
}) {
  const line = quotaLine(quota)

  return (
    <section
      aria-labelledby="drive-your-part-heading"
      className="flex flex-col gap-4"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "clamp(20px,2.6vw,28px)",
      }}
    >
      <h2
        id="drive-your-part-heading"
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: "clamp(26px,2.6vw,32px)",
          color: T.ink.base,
        }}
      >
        Your part
      </h2>
      {mine ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            <StatCard
              icon="mdi:send-outline"
              label="Sent"
              value={fmt(mine.sent)}
              bg={TYPE_TINT.neutral.bg}
              fg={TYPE_TINT.neutral.fg}
            />
            <StatCard
              icon="mdi:clock-outline"
              label="In review"
              value={fmt(mine.inReview)}
              bg={TYPE_TINT.academic.bg}
              fg={TYPE_TINT.academic.fg}
            />
            <StatCard
              icon="mdi:check-circle-outline"
              label="Accepted"
              value={fmt(mine.accepted)}
              bg={TYPE_TINT.public.bg}
              fg={TYPE_TINT.public.fg}
            />
          </div>
          {mine.sent === 0 && mine.accepted === 0 ? (
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              Nothing sent for this drive yet.
            </p>
          ) : null}
        </>
      ) : (
        <p
          className="m-0 text-[15px]"
          role="status"
          style={{ color: T.ink.dim }}
        >
          Loading your part…
        </p>
      )}
      {line || toArchivist != null ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px]">
          {line ? (
            <li
              className="flex items-start gap-2"
              style={{ color: T.ink.base }}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                height={18}
                icon="mdi:tray-full"
                style={{ color: T.ink.dim }}
                width={18}
              />
              <span>{line}</span>
            </li>
          ) : null}
          {toArchivist == null ? null : (
            <li
              className="flex items-start gap-2"
              style={{ color: T.ink.base }}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                height={18}
                icon="mdi:star-four-points-outline"
                style={{ color: T.accent.primary }}
                width={18}
              />
              <span>{earnedProLine(toArchivist)}</span>
            </li>
          )}
        </ul>
      ) : null}
    </section>
  )
}
