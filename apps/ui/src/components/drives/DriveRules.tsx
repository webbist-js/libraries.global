import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import type { Drive } from "@/lib/drives/types"

import { focusSummary, longDate, unitNoun } from "./focus-meta"

const isWebUrl = (url?: string | null): url is string =>
  !!url && /^https?:\/\//i.test(url)

function Rule({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div
      className="grid grid-cols-[minmax(90px,0.4fr)_minmax(0,1fr)] gap-3"
      style={{ borderTop: `1px solid ${T.border.divider}`, padding: "10px 0" }}
    >
      <dt className="text-sm" style={{ color: T.ink.dim }}>
        {label}
      </dt>
      <dd className="m-0 text-sm leading-[1.5]" style={{ color: T.ink.base }}>
        {children}
      </dd>
    </div>
  )
}

/**
 * A Drive's rules (spec §5.6) at `#rules`, where "How drives work" lands
 * without a Knowledge article: the Focus, where to look and on what terms,
 * the Dataset it draws on, the goal when it isn't 100%, and the dates.
 */
export function DriveRules({
  drive,
  source,
  total = null,
}: {
  readonly drive: Drive
  /** The scope's Dataset, by name. */
  readonly source: string | null
  readonly total?: number | null
}) {
  const tUi = useUiTranslations("ui")

  const where = drive.whereToLook
  const goal = drive.goalPercent ?? 100

  return (
    <section
      id="rules"
      aria-labelledby="drive-rules-heading"
      className="flex scroll-mt-24 flex-col gap-1"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <h2
        id="drive-rules-heading"
        className="type-h2 m-0 mb-1"
        style={{ color: T.ink.base }}
      >
        Rules
      </h2>
      <dl className="m-0">
        <Rule label={tUi("focus")}>{focusSummary(drive.focus)}</Rule>
        {where?.name || isWebUrl(where?.url) ? (
          <Rule label={tUi("where_to_look")}>
            {isWebUrl(where?.url) ? (
              <a
                href={where.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                {where.name || where.url}
              </a>
            ) : (
              where?.name
            )}
            {where?.licenceNote ? (
              <span className="mt-1 block" style={{ color: T.ink.dim }}>
                {where.licenceNote}
              </span>
            ) : null}
          </Rule>
        ) : null}
        {source ? <Rule label={tUi("records_from")}>{source}</Rule> : null}
        {goal !== 100 ? (
          <Rule label={tUi("goal")}>
            {goal}% of the drive’s {unitNoun(drive.unit, 2)}
            {total != null
              ? ` (${Math.ceil((total * goal) / 100).toLocaleString("en-GB")})`
              : ""}
          </Rule>
        ) : null}
        {drive.status === "scheduled" ? (
          <Rule label={tUi("opens")}>{longDate(drive.startsAt)}</Rule>
        ) : null}
        {drive.status === "closed" || drive.status === "cancelled" ? (
          <Rule label={tUi("closed")}>
            {longDate(drive.closedAt ?? drive.endsAt)}
          </Rule>
        ) : (
          <Rule label={tUi("ends")}>{longDate(drive.endsAt)}</Rule>
        )}
      </dl>
      <p
        className="m-0 mt-1 rounded-[14px] p-3 text-xs leading-[1.5]"
        style={{ color: T.ink.dim, background: T.bg.void }}
      >
        Every task is an ordinary suggestion, checked by a moderator before it
        changes a record. Libraries added after the drive opened don’t count.
      </p>
    </section>
  )
}
