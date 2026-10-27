import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { DriveChip } from "@/components/moderation/DriveChip"
import { T } from "@/lib/design-tokens"

import {
  type ContributionItem,
  kindMeta,
  relativeTime,
  statusMeta,
  titleOf,
} from "./contributions"

/**
 * One contribution: a tinted kind icon, the kind and the target's name, the
 * submitter's summary, and its status and age on the right. Used by the
 * profile's Contributions and Overview tabs and by My submissions, which
 * adds a Continue action for drafts and the moderator's note.
 */
export function ContributionRow({
  item,
  points,
  showStatusIcon = true,
  action,
  note,
}: {
  item: ContributionItem
  /** Points earned for this contribution, shown under the date. */
  points?: number | null
  showStatusIcon?: boolean
  /** A link under the status, e.g. "Continue" on a draft. */
  action?: ReactNode
  /** The moderator's note on a decision, shown under the summary. */
  note?: { text: string; tone: "warn" | "danger" } | null
}) {
  const kind = kindMeta(item.submissionType)
  const status = statusMeta(item.status)

  return (
    <li
      className="flex items-start gap-3.5 border-t px-6 py-4"
      style={{ borderTopColor: T.border.divider }}
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{
          background: `var(--tint-${kind.tint}-bg)`,
          color: `var(--tint-${kind.tint}-fg)`,
        }}
      >
        <Icon icon={kind.icon} width={19} height={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold" style={{ color: T.ink.dim }}>
          {kind.label}
        </p>
        <p
          className="m-0 truncate"
          style={{
            fontFamily: T.font.sans,
            fontSize: "var(--type-body-xl-size)",
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {titleOf(item)}
        </p>
        {item.editSummary ? (
          <p
            className="m-0 mt-0.5 truncate text-base"
            style={{ color: T.ink.dim }}
          >
            “{item.editSummary}”
          </p>
        ) : null}
        {item.drive ? (
          <div className="mt-1.5">
            <DriveChip drive={item.drive} />
          </div>
        ) : null}
        {note ? (
          <div
            className="mt-3 flex items-start gap-2.5 rounded-[14px] px-4 py-3"
            style={{
              background: note.tone === "warn" ? "#F5EEDC" : "#F6E3DA",
            }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:message-text-outline"
              width={18}
              height={18}
              className="mt-0.5 shrink-0"
              style={{
                color: note.tone === "warn" ? "#6B5420" : T.accent.danger,
              }}
            />
            <p
              className="m-0 text-base leading-[1.55]"
              style={{ color: T.ink.base }}
            >
              <span
                className="font-semibold"
                style={{
                  color: note.tone === "warn" ? "#6B5420" : T.accent.danger,
                }}
              >
                Moderator’s note:{" "}
              </span>
              {note.text}
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end text-right">
        <p
          className="m-0 inline-flex items-center gap-1 text-sm font-semibold"
          style={{ color: status.color }}
        >
          {showStatusIcon ? (
            <Icon
              icon={status.icon}
              width={16}
              height={16}
              aria-hidden="true"
            />
          ) : null}
          {status.label}
        </p>
        <p className="m-0 text-sm" style={{ color: T.ink.low }}>
          {relativeTime(item.createdAt)}
        </p>
        {points != null ? (
          <p
            className="m-0 text-sm font-semibold"
            style={{ color: "var(--tint-public-fg)" }}
          >
            +{points} points
          </p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </li>
  )
}
