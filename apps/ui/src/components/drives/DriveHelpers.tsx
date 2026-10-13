import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { DriveLeaderboardEntry } from "@/lib/drives/types"

/** Rows shown per list. */
const SHOWN = 8

const TINTS = [TYPE_TINT.national, TYPE_TINT.academic, TYPE_TINT.public]

function initialsOf(entry: DriveLeaderboardEntry): string {
  const words = (entry.displayName ?? entry.username ?? "").trim().split(/\s+/)
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
      : (words[0] ?? "").slice(0, 2)

  return letters.toUpperCase() || "?"
}

function HelperList({
  label,
  entries,
  empty,
}: {
  readonly label: string
  readonly entries: readonly DriveLeaderboardEntry[]
  readonly empty: string
}) {
  const headingId = `helpers-${label.toLowerCase().replaceAll(" ", "-")}`

  return (
    <div className="flex flex-col gap-1">
      <h3
        id={headingId}
        className="m-0 text-[15px] font-bold"
        style={{ color: T.ink.dim }}
      >
        {label}
      </h3>
      {entries.length === 0 ? (
        <p className="m-0 py-1.5 text-[15px]" style={{ color: T.ink.dim }}>
          {empty}
        </p>
      ) : (
        <ol aria-labelledby={headingId} className="m-0 list-none p-0">
          {entries.slice(0, SHOWN).map((entry, i) => {
            const tint = entry.username
              ? (TINTS[i] ?? TYPE_TINT.neutral)
              : TYPE_TINT.neutral
            const name = entry.displayName ?? entry.username ?? "A contributor"

            return (
              <li
                key={`${entry.rank}-${entry.username ?? i}`}
                className="flex items-center gap-2.5"
                style={{
                  borderTop: `1px solid ${T.border.divider}`,
                  padding: "8px 0",
                }}
              >
                <span
                  className="w-5 text-[15px] font-bold"
                  style={{ color: T.ink.dim }}
                >
                  {entry.rank}
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  {entry.username ? initialsOf(entry) : "·"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {entry.username ? (
                    <GlobalLink
                      href={`/profile/${entry.username}`}
                      className="no-underline hover:underline"
                      style={{ color: T.ink.base }}
                    >
                      {name}
                    </GlobalLink>
                  ) : (
                    <span style={{ color: T.ink.dim }}>{name}</span>
                  )}
                </span>
                <span
                  className="shrink-0 text-[14px] whitespace-nowrap"
                  style={{ color: T.ink.dim }}
                >
                  {entry.credits.toLocaleString("en-GB")} accepted
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/**
 * Who has helped a Drive, by accepted tasks (Drive Credits): this week and
 * all time. A helper whose activity is private comes back anonymised and is
 * never linked. `publicOnly` (a finished drive) lists only public helpers,
 * counts the rest and drops the week.
 */
export function DriveHelpers({
  week,
  all,
  publicOnly = false,
}: {
  readonly week: readonly DriveLeaderboardEntry[]
  readonly all: readonly DriveLeaderboardEntry[]
  readonly publicOnly?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const shownAll = publicOnly ? all.filter((e) => e.username) : all
  const hidden = all.length - shownAll.length

  return (
    <section
      aria-labelledby="drive-helpers-heading"
      className="flex flex-col gap-3"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <h2
        id="drive-helpers-heading"
        className="m-0 text-[17px] font-bold"
        style={{ color: T.ink.base }}
      >
        Helpers
      </h2>
      {publicOnly ? null : (
        <HelperList
          label={tUi("this_week")}
          entries={week}
          empty="No accepted work yet this week."
        />
      )}
      <HelperList
        label={tUi("all_time")}
        entries={shownAll}
        empty="No accepted work yet."
      />
      {hidden > 0 ? (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          And {hidden} more who {hidden === 1 ? "keeps their" : "keep their"}{" "}
          activity private.
        </p>
      ) : null}
    </section>
  )
}
