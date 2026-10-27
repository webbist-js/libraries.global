import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { KeyValueList } from "./KeyValueList"
import {
  formatDate,
  isHttpUrl,
  moderationRowLabel,
  type RoleApplicant,
} from "./submissionMeta"

const ROLE_NAMES: Record<string, string> = {
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
  moderator: "Moderator",
}

const QUEUE_NAMES: Record<string, string> = {
  index: "Index (library records)",
  knowledge: "Knowledge",
  journal: "Journal",
}

const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : []

const heading = "m-0 text-base font-semibold"

/**
 * A Role Application: the role, queue, languages and sections asked for,
 * the applicant's statement and samples, and their accepted changes.
 * Approving creates the Role Grants; a Moderator application can only be
 * decided by the editorial board, and Strapi enforces that.
 */
export function RoleApplicationPanel({
  fields: raw,
  applicant,
  localeNames,
}: {
  readonly fields: unknown
  readonly applicant: RoleApplicant | null | undefined
  /** Locale code → name, for the languages asked for. */
  readonly localeNames: Record<string, string>
}) {
  const tUi = useUiTranslations("ui")

  const f = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const role = typeof f.role === "string" ? f.role : ""
  const locales = strings(f.locales)
  const sections = strings(f.sections)
  const samples = strings(f.samples).filter(isHttpUrl)
  const statement = typeof f.statement === "string" ? f.statement.trim() : ""
  const languages =
    locales.length === 0
      ? "Any language"
      : locales.map((l) => localeNames[l] ?? l.toUpperCase()).join(", ")

  return (
    <div className="flex flex-col gap-5">
      <KeyValueList
        rows={[
          { label: "Role", value: ROLE_NAMES[role] ?? role },
          {
            label: "Queue",
            value:
              role === "moderator" && typeof f.queue === "string"
                ? (QUEUE_NAMES[f.queue] ?? f.queue)
                : "",
          },
          { label: "Languages", value: languages },
          { label: "Sections", value: sections.join(", ") },
        ].filter((r) => r.value)}
      />

      <div className="flex flex-col gap-2">
        <h3 className={`type-h3 ${heading}`} style={{ color: T.ink.base }}>
          Why they’re applying
        </h3>
        {statement ? (
          <p
            className="m-0 rounded-[14px] px-4 py-3 text-base leading-[1.6] whitespace-pre-wrap"
            style={{ background: T.bg.surface, color: T.ink.base }}
          >
            {statement}
          </p>
        ) : (
          <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
            No statement.
          </p>
        )}
      </div>

      {samples.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className={`type-h3 ${heading}`} style={{ color: T.ink.base }}>
            Samples of their work
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {samples.map((url) => (
              <li key={url} className="flex items-start gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  icon="mdi:link-variant"
                  width={16}
                  height={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: T.ink.dim }}
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline underline-offset-2"
                  style={{ color: T.accent.primary, wordBreak: "break-all" }}
                >
                  {url.length > 80 ? `${url.slice(0, 80)}…` : url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className={`type-h3 ${heading}`} style={{ color: T.ink.base }}>
          The applicant
        </h3>
        {applicant ? (
          <>
            <p className="m-0 text-base" style={{ color: T.ink.base }}>
              {applicant.username ? (
                <Link
                  href={`/profile/${encodeURIComponent(applicant.username)}`}
                  className="font-semibold underline underline-offset-2"
                  style={{ color: T.accent.primary }}
                >
                  @{applicant.username}
                </Link>
              ) : (
                <span style={{ color: T.ink.dim }}>No public profile</span>
              )}
              <span style={{ color: T.ink.dim }}>
                {" "}
                · {applicant.acceptedCount} accepted{" "}
                {applicant.acceptedCount === 1 ? "change" : "changes"}
              </span>
            </p>
            {applicant.recentAccepted.length > 0 ? (
              <ul
                aria-label={tUi("recent_accepted_changes")}
                className="m-0 list-none overflow-hidden rounded-[14px] p-0"
                style={{
                  border: `1px solid ${T.border.line}`,
                  background: T.bg.surface,
                }}
              >
                {applicant.recentAccepted.map((c, i) => (
                  <li
                    key={`${c.decidedAt}-${i}`}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm"
                    style={
                      i > 0
                        ? { borderTop: `1px solid ${T.border.divider}` }
                        : undefined
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      icon="mdi:check"
                      width={16}
                      height={16}
                      className="shrink-0"
                      style={{ color: T.accent.ok }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: T.ink.base }}
                    >
                      <span className="font-semibold">
                        {moderationRowLabel({ submissionType: c.type })}
                      </span>
                      <span style={{ color: T.ink.dim }}> · {c.summary}</span>
                    </span>
                    <span
                      className="shrink-0 text-sm"
                      style={{ color: T.ink.dim }}
                    >
                      {formatDate(c.decidedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                No accepted changes listed.
              </p>
            )}
          </>
        ) : (
          <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
            Applicant details aren’t available.
          </p>
        )}
      </div>

      <p className="m-0 text-sm leading-[1.55]" style={{ color: T.ink.dim }}>
        {role === "moderator"
          ? "Approving gives a Moderator grant for this queue in each language asked for. Only the editorial board decides Moderator applications."
          : "Approving gives an editor grant in each language asked for. Points and plans play no part in the decision."}
      </p>
    </div>
  )
}
