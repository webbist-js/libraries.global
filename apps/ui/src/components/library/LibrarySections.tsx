// Server-rendered content sections for the library detail page (v2).

import { Icon } from "@iconify/react"
import { hasOpeningHours, type LibraryNotice } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { NOTICE_TONES } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import {
  actorLabel,
  detailCount,
  fieldNames,
  isImportCreate,
  topFields,
} from "@/components/library/change-history.helpers"
import { ChangeHistogram } from "@/components/library/ChangeHistogram"
import { facilityRows } from "@/components/library/facility-rows"
import {
  buildCitation,
  formatCoordinates,
  hasStaffingDetail,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import {
  DetailsDisclosure,
  LibraryChangeTimeline,
  TimelineRow,
} from "@/components/library/LibraryChangeTimeline"
import { LibraryCopyButton } from "@/components/library/LibraryCopyButton"
import {
  OpenCorrectionLink,
  OpenVerifyLink,
} from "@/components/library/LibraryCorrection"
import { LibraryEventsEmptyAction } from "@/components/library/LibraryEventsEmptyAction"
import { LibraryFacilityAnswers } from "@/components/library/LibraryFacilityAnswers"
import { LibraryHoursTable } from "@/components/library/LibraryHoursTable"
import {
  LIB_ICONS,
  LibIcon,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import {
  availableSections,
  sectionCheckedAt,
  verifyRecordOf,
} from "@/components/library/verify.logic"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type {
  LibraryHistoryBatch,
  LibraryHistoryPage,
  LibraryHistoryStats,
  PopulatedLibraryData,
} from "@/lib/strapi-api/content/server"

type Lib = PopulatedLibraryData
const asRecord = (l: Lib) => l as unknown as Record<string, unknown>

const LINK =
  "font-semibold underline underline-offset-[3px] decoration-1 hover:decoration-2"

const fmtDate = (
  d: string | null | undefined,
  month: "short" | "long" = "short"
) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month,
        year: "numeric",
      })
    : null

function ExternalLink({
  href,
  children,
}: {
  readonly href: string
  readonly children: React.ReactNode
}) {
  const tUi = useUiTranslations("ui")

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK}
      style={{ color: T.accent.primary }}
    >
      {children} ↗<span className="sr-only"> {tUi("opens_in_a_new_tab")}</span>
    </a>
  )
}

/** A dim note line with an info icon. */
function Note({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      className="mt-3 mb-0 flex gap-2 text-[13.5px] leading-normal"
      style={{ color: T.ink.dim }}
    >
      <Icon
        aria-hidden="true"
        className="mt-[2px] shrink-0"
        height={15}
        icon="mdi:information-outline"
        width={15}
      />
      <span>{children}</span>
    </p>
  )
}

// ── Visit ────────────────────────────────────────────────────────────────────

/** The note under the hours: staffing, gaps, when they were last checked. */
function HoursNote({
  staffing,
  manyRanges,
  hasHours,
  checkedAt,
  canVerify,
}: {
  readonly staffing: boolean
  readonly manyRanges: boolean
  readonly hasHours: boolean
  /** When the hours were last confirmed. */
  readonly checkedAt: string | null
  /** Whether "Still right?" can confirm them. */
  readonly canVerify: boolean
}) {
  return (
    <Note>
      {staffing
        ? "Self-service hours: the building is open but no staff are on hand, and you may need a registered library card to get in. "
        : null}
      {manyRanges ? (
        <>
          Some days list three time ranges, possibly staffed and self-service
          hours.{" "}
          <OpenCorrectionLink category="Opening hours" className={LINK}>
            Help clarify
          </OpenCorrectionLink>
          .{" "}
        </>
      ) : null}
      {!hasHours ? (
        <>
          <OpenCorrectionLink category="Opening hours" className={LINK}>
            Add the opening hours
          </OpenCorrectionLink>
          .{" "}
        </>
      ) : checkedAt ? (
        `Checked ${fmtDate(checkedAt)}. Temporary changes appear in the notices above. `
      ) : (
        "Not yet checked. Temporary changes appear in the notices above. "
      )}
      {hasHours && canVerify ? (
        <OpenVerifyLink className={LINK} sections={["hours", "status"]}>
          Still right?
          <span className="sr-only">
            {" "}
            Confirm the opening hours and open status
          </span>
        </OpenVerifyLink>
      ) : null}
    </Note>
  )
}

export function LibraryVisitSection({ library }: { readonly library: Lib }) {
  const tUi = useUiTranslations("ui")

  const rec = asRecord(library)
  const coords = formatCoordinates(
    library.location as { lat?: unknown; lng?: unknown } | null
  )
  const addressLines = [
    library.streetAddress,
    [library.city, library.postalCode].filter(Boolean).join(" "),
    library.country?.name,
  ].filter(Boolean) as string[]
  const transitInfo = rec.transitInfo as string | null
  const nearestStation = rec.nearestStation as string | null
  const timezone = (rec.timezone as string | null) ?? null
  const openingTimes =
    (library.openingTimes as OpeningTimesValue | null) ?? null
  const confirmable = availableSections(verifyRecordOf(library))
  const staffing = hasStaffingDetail(openingTimes)
  const manyRanges =
    !staffing &&
    (openingTimes?.days ?? []).some(
      (d) => d.enabled && (d.timeframes?.length ?? 0) >= 3
    )
  // The shared rule: an enabled day with a timeframe that has both ends.
  const hasHours = hasOpeningHours(openingTimes)

  return (
    <LibrarySectionCard
      id="visit"
      title={tUi("visit")}
      iconPath={LIB_ICONS.pin}
    >
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h3
            className="m-0 mb-2 text-[15px] font-bold"
            style={{ color: T.ink.base }}
          >
            {tUi("address")}{" "}
          </h3>
          {addressLines.length > 0 ? (
            <address
              className="text-[15.5px] leading-relaxed not-italic"
              style={{ color: T.ink.base }}
            >
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          ) : (
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              Address not added yet.{" "}
              <OpenCorrectionLink
                category="Address or location"
                className={LINK}
              >
                Add it
              </OpenCorrectionLink>
            </p>
          )}
          {coords ? (
            <p
              className="mt-2 mb-0 text-[12.5px]"
              style={{ fontFamily: T.font.mono, color: T.ink.dim }}
            >
              {coords}
            </p>
          ) : null}
          {addressLines.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <LibraryCopyButton text={addressLines.join(", ")} />
              {confirmable.includes("address") ? (
                <OpenVerifyLink
                  className={`${LINK} text-[14px]`}
                  sections={["address"]}
                >
                  Still right?
                  <span className="sr-only"> Confirm the address</span>
                </OpenVerifyLink>
              ) : null}
            </div>
          ) : null}
          {nearestStation ? (
            <p className="mt-4 mb-0 flex gap-2 text-[14.5px] leading-normal">
              <LibIcon d={LIB_ICONS.train} size={17} />
              <span>
                <strong>Nearest station:</strong> {nearestStation}
              </span>
            </p>
          ) : null}
          {transitInfo ? (
            <p className="mt-3 mb-0 flex gap-2 text-[14.5px] leading-normal">
              <LibIcon d={LIB_ICONS.train} size={17} />
              <span>
                <strong>Getting there:</strong> {transitInfo}
              </span>
            </p>
          ) : null}
        </div>

        <div>
          <h3
            className="m-0 mb-1 text-[15px] font-bold"
            style={{ color: T.ink.base }}
          >
            {tUi("opening_hours")}{" "}
            {timezone ? (
              <span className="font-normal" style={{ color: T.ink.dim }}>
                {timezone}
              </span>
            ) : null}
          </h3>
          <LibraryHoursTable
            openingTimes={openingTimes}
            timezone={timezone}
            notices={rec.notices as LibraryNotice[] | undefined}
          />
          <HoursNote
            canVerify={confirmable.includes("hours")}
            checkedAt={sectionCheckedAt(library, "hours")}
            hasHours={hasHours}
            manyRanges={manyRanges}
            staffing={staffing}
          />
        </div>
      </div>
    </LibrarySectionCard>
  )
}

// ── Accessibility & facilities ───────────────────────────────────────────────

export function LibraryFacilitiesSection({
  library,
  path,
}: {
  readonly library: Lib
  readonly path: string
}) {
  const tUi = useUiTranslations("ui")

  const rows = facilityRows(library)
  const unknown = rows.filter((r) => r.state === "unknown").length
  const known = rows.length - unknown
  const intro =
    known === 0 ? (
      "None of these are documented yet. Know the answer? Tap Yes or No."
    ) : unknown > 0 ? (
      `${known} answered. Know the others? Tap Yes or No.`
    ) : (
      <>
        Spotted something wrong?{" "}
        <OpenCorrectionLink category="Accessibility" className={LINK}>
          {tUi("suggest_a_correction")}
        </OpenCorrectionLink>
        .
      </>
    )

  return (
    <LibrarySectionCard
      id="access"
      title={tUi("accessibility_and_facilities")}
      iconPath={LIB_ICONS.access}
      intro={intro}
    >
      <LibraryFacilityAnswers
        libraryName={library.name ?? ""}
        libraryPath={path}
        librarySlug={library.slug ?? ""}
        rows={rows}
      />
      <p className="mt-3 mb-0 text-[13.5px]" style={{ color: T.ink.dim }}>
        {unknown > 0
          ? "Your answer goes to a reviewer before it’s shown. "
          : null}
        Please check with the library before visiting if something matters to
        you.
      </p>
    </LibrarySectionCard>
  )
}

// ── History / Collections / Events ───────────────────────────────────────────

/** Timeline entries from the record's year and building fields. */
export function historyEntries(library: Lib): { year: string; text: string }[] {
  const rec = asRecord(library)
  const entries: { year: string; text: string }[] = []
  const foundedYear = rec.foundedYear as string | null
  const openedYear = rec.openedYear as string | null
  const closedYear = rec.closedYear as string | null
  const architect = rec.architect as string | null
  const buildingInfo = rec.buildingInfo as string | null

  if (foundedYear) entries.push({ year: foundedYear, text: "Founded." })
  if (openedYear && openedYear !== foundedYear)
    entries.push({
      year: openedYear,
      text: architect
        ? `Building opened${buildingInfo ? `: ${buildingInfo}` : ""}, designed by ${architect}.`
        : "Building opened to readers.",
    })
  if (closedYear) entries.push({ year: closedYear, text: "Closed." })
  if (!openedYear && (architect || buildingInfo)) {
    entries.push({
      year: "",
      text: [buildingInfo, architect ? `Architect: ${architect}` : null]
        .filter(Boolean)
        .join(" · "),
    })
  }

  return entries
}

function CardAction({ children }: { readonly children: React.ReactNode }) {
  return <div className="mt-auto pt-4 text-[14px]">{children}</div>
}

export function LibraryHistorySection({ library }: { readonly library: Lib }) {
  const tUi = useUiTranslations("ui")

  const entries = historyEntries(library)

  return (
    <LibrarySectionCard
      id="history"
      title={tUi("history")}
      iconPath={LIB_ICONS.clock}
      tone="special"
      compact
      dashed={entries.length === 0}
    >
      {entries.length > 0 ? (
        <ol className="m-0 flex list-none flex-col p-0">
          {entries.map((e, i) => (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              <span
                aria-hidden="true"
                className="relative mt-[9px] flex w-3 shrink-0 justify-center"
              >
                <span
                  className="size-2.5 rounded-full border-2"
                  style={{ borderColor: "var(--tint-special-fg)" }}
                />
                {i < entries.length - 1 ? (
                  <span
                    className="absolute top-3.5 h-[calc(100%+4px)] w-px"
                    style={{ background: T.border.hi }}
                  />
                ) : null}
              </span>
              <span>
                {e.year ? (
                  <span
                    className="block text-[22px] leading-tight"
                    style={{
                      fontFamily: T.font.serif,
                      color: "var(--tint-special-fg)",
                    }}
                  >
                    {e.year}
                  </span>
                ) : null}
                <span className="block text-[14.5px] leading-snug">
                  {e.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p
          className="m-0 text-[14.5px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          Not documented yet. When it opened, moved or was rebuilt all help.
        </p>
      )}
      <CardAction>
        <OpenCorrectionLink category="Something else" className={LINK}>
          Add a date or event
        </OpenCorrectionLink>
      </CardAction>
    </LibrarySectionCard>
  )
}

/** Whether the Collections section has anything to show beyond its prompt. */
export function hasCollections(library: Lib): boolean {
  const rec = asRecord(library)
  const description = library.description as unknown[] | null

  return (
    Boolean(library.summary) ||
    (Array.isArray(description) && description.length > 0) ||
    ((rec.collectionStats as unknown[] | null)?.length ?? 0) > 0 ||
    Boolean(rec.catalogueUrl) ||
    Boolean(rec.iiifEndpoint)
  )
}

export function LibraryCollectionsSection({
  library,
}: {
  readonly library: Lib
}) {
  const tUi = useUiTranslations("ui")

  const rec = asRecord(library)

  if (!hasCollections(library))
    return (
      <LibrarySectionCard
        id="collections"
        title={tUi("collections")}
        iconPath={LIB_ICONS.book}
        tone="neutral"
        compact
        dashed
      >
        <p
          className="m-0 text-[14.5px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          Not documented yet. Local studies, languages and special holdings are
          especially useful.
        </p>
        <CardAction>
          <OpenCorrectionLink category="Collections" className={LINK}>
            Describe the collections
          </OpenCorrectionLink>
        </CardAction>
      </LibrarySectionCard>
    )

  const description = library.description as unknown[] | null
  const summary = library.summary as string | null
  const collectionStats = (rec.collectionStats ?? []) as {
    value: string
    category?: string | null
    description?: string | null
  }[]
  const catalogueUrl = rec.catalogueUrl as string | null
  const iiifEndpoint = rec.iiifEndpoint as string | null

  return (
    <LibrarySectionCard
      id="collections"
      title={tUi("collections")}
      iconPath={LIB_ICONS.book}
      tone="neutral"
    >
      {Array.isArray(description) && description.length > 0 ? (
        <div className="max-w-[68ch] text-[17px] leading-relaxed">
          <StrapiBlocksContent
            blocks={
              description as Parameters<typeof StrapiBlocksContent>[0]["blocks"]
            }
          />
        </div>
      ) : summary ? (
        <p className="m-0 max-w-[68ch] text-[17px] leading-relaxed">
          {summary}
        </p>
      ) : null}

      {collectionStats.length > 0 ? (
        <ul className="mt-5 mb-0 grid gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {collectionStats.map((stat, i) => (
            <li
              key={i}
              className="list-none rounded-2xl px-4 py-3.5"
              style={{
                background: T.bg.surface,
                border: `1px solid ${T.border.line}`,
              }}
            >
              <span
                className="block text-[26px] leading-tight"
                style={{ fontFamily: T.font.serif, color: T.ink.base }}
              >
                {stat.value}
              </span>
              <span className="block text-[14px]" style={{ color: T.ink.dim }}>
                {stat.category ?? stat.description ?? ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {catalogueUrl || iiifEndpoint ? (
        <div className="mt-4 flex flex-wrap gap-4 text-[15px]">
          {catalogueUrl ? (
            <ExternalLink href={catalogueUrl}>
              Search the catalogue
            </ExternalLink>
          ) : null}
          {iiifEndpoint ? (
            <ExternalLink href={iiifEndpoint}>
              Digitised collections
            </ExternalLink>
          ) : null}
        </div>
      ) : null}
    </LibrarySectionCard>
  )
}

/**
 * The compact Events card for a library without an event feed. Staff get a
 * link to the feeds page; everyone else to the claim flow.
 */
export function LibraryEventsEmpty({
  documentId,
  librarySlug,
  libraryName,
}: {
  readonly documentId: string
  readonly librarySlug: string
  readonly libraryName: string
}) {
  const tUi = useUiTranslations("ui")

  return (
    <LibrarySectionCard
      id="events"
      title={tUi("events")}
      iconPath={LIB_ICONS.calendar}
      tone="neutral"
      compact
      dashed
    >
      <p
        className="m-0 text-[14.5px] leading-normal"
        style={{ color: T.ink.dim }}
      >
        No events listed yet. Staff can connect the library&rsquo;s events
        calendar from the staff area.
      </p>
      <CardAction>
        <LibraryEventsEmptyAction
          documentId={documentId}
          libraryName={libraryName}
          librarySlug={librarySlug}
        />
      </CardAction>
    </LibrarySectionCard>
  )
}

// ── Changes (history, histogram, sources) ───────────────────────────────────

const SOURCE_NAMES: Record<string, string> = {
  libraryon: "LibraryOn",
  wikidata: "Wikidata",
  manual: "A contributor",
}

const PUBLISHERS: Record<string, string> = {
  libraryon: "the British Library",
}

function HistoryStat({
  label,
  value,
  sub,
  color = T.ink.base,
}: {
  readonly label: string
  readonly value: React.ReactNode
  readonly sub: React.ReactNode
  readonly color?: string
}) {
  return (
    <div
      className="min-w-0 rounded-[20px] px-5 py-4"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <p className="m-0 text-[15px] font-semibold" style={{ color: T.ink.dim }}>
        {label}
      </p>
      <p
        className="m-0 mt-0.5 text-[30px] leading-tight break-words"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color }}
      >
        {value}
      </p>
      <p className="m-0 mt-1 text-[15px]" style={{ color: T.ink.dim }}>
        {sub}
      </p>
    </div>
  )
}

/** "3 people and library staff", from the batches on page 1. */
function changedBy(batches: readonly LibraryHistoryBatch[]): string | null {
  const people = new Set<string>()
  let staff = false
  let team = false
  for (const b of batches) {
    if (b.source === "import") continue
    if (b.source === "staff") staff = true
    else if (b.actor.kind === "contributor")
      people.add(b.actor.username ?? b.batchId)
    else if (b.actor.kind === "admin") team = true
  }
  const parts = [
    people.size
      ? `${people.size} ${people.size === 1 ? "person" : "people"}`
      : "",
    staff ? "library staff" : "",
    team ? "Libraries Global" : "",
  ].filter(Boolean)
  if (parts.length === 0) return null

  return parts.length === 1
    ? parts[0]!
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
}

/** "5 changes in the last 5 months." and "Most recent in September." */
function activitySummary(months: LibraryHistoryStats["months"]) {
  const busy = months.flatMap((m, i) => (m.batches > 0 ? [i] : []))
  if (busy.length === 0) return null
  const n = months.reduce((sum, m) => sum + m.batches, 0)
  const span = months.length - busy[0]!
  const [y, mo] = (months[busy.at(-1)!]?.month ?? "").split("-").map(Number)
  const latest =
    y && mo
      ? new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-GB", {
          month: "long",
          timeZone: "UTC",
        })
      : null

  return {
    lead: `${n} ${n === 1 ? "change" : "changes"} in the last ${span === 1 ? "month" : `${span} months`}.`,
    latest: latest ? `Most recent in ${latest}.` : null,
  }
}

export function LibraryChangesSection({
  library,
  history = null,
  stats = null,
  dataset = null,
}: {
  readonly library: Lib
  /** Page 1 of the Change Batches; null when Strapi couldn't answer. */
  readonly history?: LibraryHistoryPage | null
  /** Change counts for the last 24 months; null when unavailable. */
  readonly stats?: LibraryHistoryStats | null
  /** The dataset the record was imported from, from the dataset registry. */
  readonly dataset?: DatasetRecord | null
}) {
  const tUi = useUiTranslations("ui")

  const rec = asRecord(library)
  const source = rec.source as string | null
  const sourceUrl = rec.sourceUrl as string | null
  const lastVerifiedAt = rec.lastVerifiedAt as string | null
  const createdAt = rec.createdAt as string | null
  const months = stats?.months.slice(-12) ?? []
  const activity = activitySummary(months)
  const most = stats
    ? topFields(
        stats.byField.filter((f) => f.field !== "lastVerifiedAt"),
        3
      )
    : []

  const batches = history?.data ?? []
  const imported = batches.find(isImportCreate) ?? null
  const changes = history
    ? history.meta.total - batches.filter(isImportCreate).length
    : null
  const checkedBy = batches.find((b) =>
    b.fields.some((f) => f.field === "lastVerifiedAt")
  )
  const unchecked = Boolean(source) && !lastVerifiedAt && changes === 0

  const sourceName =
    dataset?.name ?? (source ? (SOURCE_NAMES[source] ?? source) : null)
  const publisher =
    dataset?.publisher ?? (source ? (PUBLISHERS[source] ?? null) : null)
  const datasetLink = sourceUrl || dataset?.sourceUrl || null
  const licence = dataset?.licence ? (
    dataset.licenceUrl ? (
      <a
        href={dataset.licenceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-[3px]"
      >
        {dataset.licence}
      </a>
    ) : (
      dataset.licence
    )
  ) : null

  const created = source ? (
    <TimelineRow
      icon={LIB_ICONS.download}
      tone="import"
      title={tUi("record_created")}
      lead={
        <>
          from{" "}
          {datasetLink ? (
            <a
              href={datasetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {sourceName}
            </a>
          ) : (
            sourceName
          )}
          {publisher ? `, published by ${publisher}` : ""}.
          {dataset?.attribution ? (
            <span className="block text-[13px]">{dataset.attribution}</span>
          ) : null}
        </>
      }
      meta={["Data import", fmtDate(createdAt), licence]}
    >
      {imported && imported.fields.length > 0 ? (
        <DetailsDisclosure
          label={detailCount(imported.fields.length, "imported")}
        >
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            {fieldNames(imported.fields, 12)}
          </p>
        </DetailsDisclosure>
      ) : null}
    </TimelineRow>
  ) : (
    <TimelineRow
      icon={LIB_ICONS.plus}
      tone="indigo"
      title={tUi("record_created")}
      lead="by a contributor."
      meta={[fmtDate(createdAt)]}
    />
  )

  const added =
    `${source ? "Imported" : "Added"} ${fmtDate(createdAt) ?? ""}`.trim()

  return (
    <LibrarySectionCard
      id="changes"
      title={tUi("history_and_sources")}
      iconPath={LIB_ICONS.clock}
      tone="neutral"
      intro="Where this record came from, and everything that’s changed since."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <HistoryStat
          label="Came from"
          value={sourceName ?? "A contributor"}
          sub={
            [publisher?.replace(/^the /, ""), dataset?.licence]
              .filter(Boolean)
              .join(" · ") || added
          }
        />
        <HistoryStat
          label={tUi("changes_since")}
          value={changes == null ? "Unavailable" : changes || "None yet"}
          sub={changes ? `By ${changedBy(batches) ?? "contributors"}` : added}
        />
        <HistoryStat
          label={tUi("checked_by_a_person")}
          value={lastVerifiedAt ? fmtDate(lastVerifiedAt) : "Not yet"}
          color={lastVerifiedAt ? T.accent.ok : TYPE_TINT.special.fg}
          sub={
            lastVerifiedAt
              ? checkedBy
                ? `By ${actorLabel(checkedBy).text}`
                : "Most recent check"
              : "Be the first"
          }
        />
      </div>

      {unchecked ? (
        <div
          className="mt-5 flex flex-col gap-4 rounded-[20px] px-5 py-4 sm:flex-row sm:items-center"
          style={{ background: NOTICE_TONES.warn.bg }}
        >
          <Icon
            aria-hidden="true"
            icon="lucide:triangle-alert"
            width={22}
            height={22}
            className="hidden shrink-0 self-start sm:mt-0.5 sm:block"
            style={{ color: T.ink.base }}
          />
          <div className="min-w-0 flex-1 text-[15px] leading-normal">
            <p className="m-0 font-semibold" style={{ color: T.ink.base }}>
              Imported, not checked by a person yet
            </p>
            <p className="m-0 mt-0.5" style={{ color: T.ink.dim }}>
              Everything here came from one dataset. If you know this library,
              confirm what’s right or fix what isn’t.
            </p>
          </div>
          <OpenCorrectionLink className="shrink-0 self-start rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[15px] font-semibold text-white! hover:bg-(--t-accent-primary-hover) sm:self-center">
            {tUi("suggest_a_correction")}
          </OpenCorrectionLink>
        </div>
      ) : null}

      {activity ? (
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-end">
          <div className="min-w-0">
            <p className="m-0 mb-3 text-[15px]" style={{ color: T.ink.dim }}>
              <strong style={{ color: T.ink.base }}>{activity.lead}</strong>
              {activity.latest ? ` ${activity.latest}` : null}
            </p>
            <ChangeHistogram
              months={months}
              verificationEvents={stats?.verificationEvents ?? []}
            />
          </div>
          {most.length > 0 ? (
            <div className="md:pb-8">
              <h3
                className="m-0 text-[15px] font-semibold"
                style={{ color: T.ink.base }}
              >
                Most often updated
              </h3>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                {most.map((f) => (
                  <li
                    key={f.field}
                    className="rounded-full px-3.5 py-1.5 text-[14px] font-semibold"
                    style={{ background: T.bg.muted, color: T.ink.base }}
                  >
                    {f.label}{" "}
                    <span className="font-normal" style={{ color: T.ink.dim }}>
                      {f.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <h3
        className="mt-6 mb-0 pb-3 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Timeline
      </h3>
      {history ? (
        <LibraryChangeTimeline
          documentId={library.documentId}
          initial={history}
          created={created}
        />
      ) : (
        <>
          <p className="m-0 mb-3 text-[15px]" style={{ color: T.ink.dim }}>
            Change history is unavailable right now. Try again later.
          </p>
          <ul className="m-0 list-none p-0">{created}</ul>
        </>
      )}
    </LibrarySectionCard>
  )
}

// ── Cite or reuse ────────────────────────────────────────────────────────────

const REUSE_PILL =
  "inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

export function LibraryReuseSection({
  library,
  url,
}: {
  readonly library: Lib
  /** The record's canonical, absolute URL. */
  readonly url: string
}) {
  const tUi = useUiTranslations("ui")

  const rec = asRecord(library)
  const citation = buildCitation({
    name: library.name ?? "Library",
    entityRef: library.entityRef,
    updatedAt:
      (rec.contentUpdatedAt as string | null) ??
      (rec.updatedAt as string | null),
    url,
  })
  const recordHref = `/api/libraries/${encodeURIComponent(library.slug ?? "")}/record`

  return (
    <section
      id="reuse"
      aria-labelledby="reuse-h"
      className="grid scroll-mt-32 gap-6 rounded-3xl p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center"
      style={{ background: T.bg.space, border: `1px solid ${T.border.line}` }}
    >
      <div>
        <h2
          id="reuse-h"
          className="m-0 text-[26px] leading-tight sm:text-[28px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          Cite or reuse this record
        </h2>
        <p
          className="mt-2 mb-0 text-[14.5px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          Open data under{" "}
          <GlobalLink
            href="/legal/data-licence"
            className="underline underline-offset-2"
          >
            CC BY-SA 4.0
          </GlobalLink>
          . Imported details keep their original licence and credit.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className={REUSE_PILL}
            download
            href={`${recordHref}?format=json`}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            JSON
          </a>
          <a
            className={REUSE_PILL}
            download
            href={`${recordHref}?format=csv`}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            CSV
          </a>
          <GlobalLink
            className={REUSE_PILL}
            href="/knowledge/data-api/the-public-api"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            API docs
          </GlobalLink>
        </div>
      </div>
      <figure
        className="m-0 rounded-2xl p-4"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <blockquote
          className="m-0 text-[14px] leading-relaxed wrap-break-word"
          style={{ color: T.ink.base }}
        >
          {citation}
        </blockquote>
        <figcaption className="mt-3">
          <LibraryCopyButton label={tUi("copy_citation")} text={citation} />
        </figcaption>
      </figure>
    </section>
  )
}
