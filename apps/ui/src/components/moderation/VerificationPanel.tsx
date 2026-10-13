import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Notice } from "@/components/ds/Notice"
import {
  SECTION_LABELS,
  sectionCheckedAt,
  statusLabel,
  toSections,
  type VerifySection,
} from "@/components/library/verify.logic"
import { T } from "@/lib/design-tokens"

import { KeyValueList } from "./KeyValueList"
import { hoursLines } from "./RecordChangesTable"
import { EVIDENCE_TYPE_LABELS, isHttpUrl } from "./submissionMeta"

/** Strapi's `review` for a verify: the library's live values and stamps. */
type VerifyReview = {
  sections?: unknown
  current: Record<string, unknown>
  verifiedSections?: Record<string, unknown> | null
  lastVerifiedAt?: string | null
}

/** Strapi loads a review only while the submission is open. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["pending", "needs_info"])

const isReview = (v: unknown): v is VerifyReview =>
  !!v &&
  typeof v === "object" &&
  typeof (v as VerifyReview).current === "object" &&
  (v as VerifyReview).current !== null

const text = (v: unknown): string =>
  typeof v === "string" && v.trim() ? v.trim() : ""

/** "1 Jan 2025", or null when the stamp isn't a date. */
function checkedOn(iso: unknown): string | null {
  if (typeof iso !== "string" || Number.isNaN(Date.parse(iso))) return null

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function Lines({ lines }: { readonly lines: string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <span key={line} className="break-words">
          {line}
        </span>
      ))}
    </div>
  )
}

function Missing({ children }: { readonly children: ReactNode }) {
  return <span style={{ color: T.ink.faint }}>{children}</span>
}

/** What the record says now for one section. */
function LiveValue({
  section,
  current,
}: {
  readonly section: VerifySection
  readonly current: Record<string, unknown>
}) {
  const tUi = useUiTranslations("ui")

  switch (section) {
    case "hours": {
      const lines = hoursLines(current.openingTimes)

      return lines?.length ? (
        <Lines lines={lines} />
      ) : (
        <Missing>No hours recorded</Missing>
      )
    }
    case "status":
      return statusLabel(current.operationalStatus) ? (
        <span>{statusLabel(current.operationalStatus)}</span>
      ) : (
        <Missing>No status recorded</Missing>
      )
    case "address": {
      const lines = [
        text(current.streetAddress),
        text(current.district),
        [text(current.city), text(current.postalCode)]
          .filter(Boolean)
          .join(" "),
      ].filter(Boolean)

      return lines.length ? (
        <Lines lines={lines} />
      ) : (
        <Missing>No address recorded</Missing>
      )
    }
    case "contact": {
      const rows = [
        { label: "Website", value: text(current.website) },
        { label: tUi("phone"), value: text(current.phone) },
        { label: tUi("email"), value: text(current.email) },
      ].filter((r) => r.value)

      return rows.length ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt style={{ color: T.ink.dim }}>{r.label}</dt>
              <dd className="m-0 min-w-0 break-words">
                {isHttpUrl(r.value) ? (
                  <a
                    href={r.value}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline"
                    style={{ color: T.accent.primary, wordBreak: "break-all" }}
                  >
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <Missing>No contact details recorded</Missing>
      )
    }
  }
}

/**
 * "Still right?" (a correction with `fields.kind: "verify"`): the sections
 * a reader confirmed, each with the library's live value (`review.current`,
 * loaded by Strapi) and when it was last checked, by the same rule as the
 * library page. Approval changes no values; it stamps each section as
 * checked today.
 */
export function VerificationPanel({
  fields,
  review: rawReview,
  status = null,
  evidenceType = null,
  evidenceUrl = null,
}: {
  readonly fields: unknown
  readonly review: unknown
  /** The submission's status: a decided one has no review to show. */
  readonly status?: string | null
  readonly evidenceType?: string | null
  readonly evidenceUrl?: string | null
}) {
  const tUi = useUiTranslations("ui")

  const sections = toSections(
    (fields as { sections?: unknown } | null)?.sections
  )
  const review = isReview(rawReview) ? rawReview : null
  // Without a review, an open submission's library is gone; a decided one
  // simply isn't reviewed any more.
  const missing = !review && status !== null && OPEN_STATUSES.has(status)
  const evidence = [
    evidenceType === "on_site_visit"
      ? {
          label: "How they checked",
          value: EVIDENCE_TYPE_LABELS.on_site_visit,
        }
      : null,
    evidenceUrl ? { label: "The page they checked", value: evidenceUrl } : null,
  ].filter((r): r is { label: string; value: string } => r !== null)

  if (sections.length === 0)
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        No sections to confirm in this submission.
      </p>
    )

  return (
    <div className="flex flex-col gap-4">
      <p
        className="m-0 text-[14px] leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        Approving marks each section below as checked today. Nothing in the
        record changes, so check the live values against how they checked.
      </p>
      {missing ? (
        <Notice
          icon="mdi:alert-circle-outline"
          title={tUi("the_library_could_not_be_found")}
          tone="warn"
        >
          It may have been deleted or renamed, so approving changes nothing.
        </Notice>
      ) : null}
      <KeyValueList rows={evidence} />
      <h3
        className="m-0 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Confirms these are still right
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {sections.map((s) => {
          const last = checkedOn(review ? sectionCheckedAt(review, s) : null)

          return (
            <li
              key={s}
              className="flex flex-col gap-1.5 rounded-[14px] px-4 py-3 text-[15px]"
              style={{
                background: T.bg.surface,
                border: `1px solid ${T.border.line}`,
                color: T.ink.base,
              }}
            >
              <h4 className="m-0 text-[15px] font-semibold">
                {SECTION_LABELS[s]}
              </h4>
              {review ? (
                <LiveValue current={review.current} section={s} />
              ) : null}
              <p
                className="m-0 flex items-center gap-1.5 text-[13.5px]"
                style={{ color: T.ink.dim }}
              >
                <Icon
                  aria-hidden="true"
                  height={15}
                  icon={
                    last
                      ? "mdi:calendar-check-outline"
                      : "mdi:calendar-blank-outline"
                  }
                  width={15}
                />
                {last ? `Last checked ${last}` : "Not checked before"}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
