import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Link } from "@/lib/navigation"

import {
  formatDate,
  moderationRowLabel,
  type RoleApplicant,
} from "./submissionMeta"

/** The same contribution evidence for role applicants and drive proposers; no decision logic. */
export function ApplicantSummary({
  applicant,
  missingLabel,
}: {
  readonly applicant: RoleApplicant | null | undefined
  readonly missingLabel: string
}) {
  const t = useTranslations("applicantSummary")
  if (!applicant)
    return <p className="m-0 text-sm text-(--t-ink-dim)">{missingLabel}</p>

  return (
    <>
      <p className="m-0 text-base text-(--t-ink-base)">
        {applicant.username ? (
          <Link
            href={`/profile/${encodeURIComponent(applicant.username)}`}
            className="font-semibold text-(--t-accent-primary) underline underline-offset-2"
          >
            @{applicant.username}
          </Link>
        ) : (
          <span className="text-(--t-ink-dim)">{t("noProfile")}</span>
        )}
        <span className="text-(--t-ink-dim)">
          {" "}
          · {t("accepted", { count: applicant.acceptedCount })}
        </span>
      </p>
      {applicant.recentAccepted.length ? (
        <ul
          aria-label={t("recent")}
          className="m-0 list-none overflow-hidden rounded-[14px] border border-(--t-border-line) bg-(--t-bg-surface) p-0"
        >
          {applicant.recentAccepted.map((change, index) => (
            <li
              // eslint-disable-next-line react/no-array-index-key -- This read-only summary intentionally omits private submission IDs.
              key={`${change.decidedAt}-${index}`}
              className="flex flex-wrap items-center gap-2.5 border-(--t-divider) px-3.5 py-2.5 text-sm not-first:border-t"
            >
              <Icon
                aria-hidden="true"
                icon="mdi:check"
                width={16}
                height={16}
                className="shrink-0 text-(--t-accent-ok)"
              />
              <span className="min-w-0 flex-1 wrap-anywhere text-(--t-ink-base)">
                <span className="font-semibold">
                  {moderationRowLabel({ submissionType: change.type })}
                </span>
                <span className="text-(--t-ink-dim)"> · {change.summary}</span>
              </span>
              <time
                dateTime={change.decidedAt}
                className="shrink-0 text-(--t-ink-dim)"
              >
                {formatDate(change.decidedAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-(--t-ink-dim)">{t("empty")}</p>
      )}
    </>
  )
}
