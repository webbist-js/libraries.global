"use client"

import { ArrowUpRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import { DriveChip } from "@/components/moderation/DriveChip"
import { reviewHref } from "@/components/moderation/queue-navigation"
import { StatusBadge } from "@/components/moderation/StatusBadge"
import {
  formatDate,
  moderationRowLabel,
  TYPE_COLORS,
  type ModerationRow,
} from "@/components/moderation/submissionMeta"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const cell = "px-4 py-4 text-left align-top text-[14px]"

/** Presentation only; the guarded queue supplies server-scoped submissions. */
export function ModerationSubmissionList({
  rows,
  localeNames,
  returnTo,
}: {
  rows: readonly ModerationRow[]
  localeNames: Record<string, string>
  returnTo?: string
}) {
  const tUi = useTranslations("ui")

  return (
    <div className="overflow-x-auto rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)">
      <table className="w-full min-w-[760px] border-collapse">
        <caption className="sr-only">Submissions to review</caption>
        <thead>
          <tr className="bg-(--t-bg-surface)">
            {[
              tUi("type"),
              "Submission",
              "Contributor",
              tUi("language"),
              "Submitted",
              tUi("status"),
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className={cell + " font-semibold text-(--t-ink-dim)"}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.documentId}
              className="border-t border-(--t-border-line) transition-colors hover:bg-(--t-palette-violet-soft)"
            >
              <td className={cell}>
                <Badge
                  label={moderationRowLabel(row)}
                  color={TYPE_COLORS[row.submissionType] ?? "dim"}
                />
              </td>
              <th scope="row" className={cell + " font-semibold"}>
                <div className="flex flex-col items-start gap-1.5">
                  <Link
                    href={reviewHref(row.documentId, returnTo)}
                    className="inline-flex items-start gap-1.5 text-[15px] leading-relaxed font-semibold text-(--t-accent-primary) underline-offset-2 hover:underline"
                  >
                    {row.summary}
                    <ArrowUpRight
                      size={14}
                      className="mt-1 shrink-0"
                      aria-hidden
                    />
                  </Link>
                  {row.drive && <DriveChip drive={row.drive} />}
                  {row.staffReviewHint && (
                    <Badge label={row.staffReviewHint} color="aurora" />
                  )}
                </div>
              </th>
              <td className={cell}>{row.submittedByName ?? "Anonymous"}</td>
              <td className={cell}>
                {localeNames[row.locale] ?? row.locale.toUpperCase()}
              </td>
              <td className={cell} style={{ color: T.ink.dim }}>
                <time dateTime={row.createdAt}>
                  {formatDate(row.createdAt)}
                </time>
              </td>
              <td className={cell}>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
