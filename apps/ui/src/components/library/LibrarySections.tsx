// Server-rendered content sections for the library detail page (v2).

import { Icon } from "@iconify/react"
import {
  librarySourceKey,
  publicSourceUrl,
  type LibrarySourceRecord,
  hasOpeningHours,
  type LibraryNotice,
} from "@repo/shared-data"
import { useFormatter, useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import {
  fieldLabel,
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
import { LibraryChangeTimeline } from "@/components/library/LibraryChangeTimeline"
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
import { T } from "@/lib/design-tokens"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type {
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

// ── History and sources ────────────────────────────────────────────────────

const SOURCE_NAMES: Record<string, string> = {
  libraryon: "LibraryOn",
  wikidata: "Wikidata",
  manual: "A contributor",
}

export function LibraryChangesSection({
  library,
  history = null,
  stats = null,
  datasets = [],
}: {
  readonly library: Lib
  /** Page 1 of the Change Batches; null when Strapi couldn't answer. */
  readonly history?: LibraryHistoryPage | null
  /** Changes after creation, over the last 24 months. */
  readonly stats?: LibraryHistoryStats | null
  readonly datasets?: DatasetRecord[]
}) {
  const tUi = useUiTranslations("ui")
  const formatter = useFormatter()
  const rec = asRecord(library)
  const sourceRecords = (rec.sourceRecords ?? []) as LibrarySourceRecord[]
  const references = [
    ...sourceRecords.filter((record) => record.role === "origin"),
    ...sourceRecords.filter((record) => record.role !== "origin"),
  ]
  const source = librarySourceKey(references)
  const lastVerifiedAt = rec.lastVerifiedAt as string | null
  const createdAt = rec.createdAt as string | null
  const formatDate = (value: string | null | undefined) => {
    if (!value) return null
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : formatter.dateTime(date, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
  }
  const checkedDate = formatDate(lastVerifiedAt)
  const addedDate = formatDate(createdAt)
  const added = addedDate
    ? tUi(
        source && source !== "manual"
          ? "history_imported_on"
          : "history_added_on",
        { date: addedDate }
      )
    : null
  const batches = history?.data ?? []
  const hasChanges =
    batches.some((batch) => !isImportCreate(batch)) ||
    Boolean(history && history.meta.total > batches.length)
  const months = stats?.months.slice(-12) ?? []
  // A quiet record needs its timeline, not a mostly empty chart.
  const showActivity =
    hasChanges &&
    months.reduce((sum, month) => sum + month.batches, 0) >= 3 &&
    months.filter((month) => month.batches > 0).length >= 2
  const most = topFields(
    (stats?.byField ?? []).filter(
      (field) => field.field !== "*" && field.field !== "lastVerifiedAt"
    ),
    3
  )
  const datasetByKey = new Map(
    datasets.map((dataset) => [dataset.key, dataset])
  )
  const creditedDatasets = new Set<string>()

  return (
    <LibrarySectionCard
      id="changes"
      title={tUi("history_and_sources")}
      iconPath={LIB_ICONS.clock}
      tone="neutral"
    >
      {references.length ? (
        <ul className="m-0 grid list-none gap-4 p-0">
          {references.map((reference, index) => {
            const credit = reference.dataset
              ? datasetByKey.get(reference.dataset)
              : undefined
            const showCredit = Boolean(
              credit && !creditedDatasets.has(credit.key)
            )
            if (credit) creditedDatasets.add(credit.key)
            const url =
              publicSourceUrl(reference.url) ??
              publicSourceUrl(credit?.sourceUrl)
            const title =
              reference.label ||
              credit?.name ||
              (reference.dataset
                ? (SOURCE_NAMES[reference.dataset] ?? reference.dataset)
                : null) ||
              url ||
              tUi("history_source_reference")
            const retrieved = formatDate(reference.retrievedAt)
            const licenceUrl = publicSourceUrl(credit?.licenceUrl)
            const licence =
              showCredit && credit?.licence ? (
                licenceUrl ? (
                  <a
                    href={licenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {credit.licence}
                  </a>
                ) : (
                  credit.licence
                )
              ) : null
            const supportedFields = Array.isArray(reference.fields)
              ? reference.fields.filter((field) => typeof field === "string")
              : []
            const details = Boolean(
              reference.recordId ||
              retrieved ||
              supportedFields.length ||
              (showCredit && credit?.attribution && licence)
            )

            return (
              <li key={index} className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p
                    className="m-0 text-[16px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-[3px]"
                      >
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                  </p>
                  {index === 0 && added ? (
                    <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
                      {added}
                    </p>
                  ) : null}
                </div>
                {showCredit && credit?.attribution ? (
                  <p
                    className="m-0 mt-1 text-[14px] leading-normal"
                    style={{ color: T.ink.dim }}
                  >
                    {credit.attribution}
                  </p>
                ) : showCredit && (credit?.publisher || licence) ? (
                  <p
                    className="m-0 mt-1 text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    {credit?.publisher}
                    {credit?.publisher && licence ? " · " : null}
                    {licence}
                  </p>
                ) : null}
                {details ? (
                  <details
                    className="mt-1.5 text-[13px]"
                    style={{ color: T.ink.dim }}
                  >
                    <summary className="w-fit cursor-pointer underline underline-offset-2">
                      {tUi("history_source_details")}
                    </summary>
                    <dl className="m-0 mt-2 grid gap-1">
                      {showCredit && credit?.attribution && licence ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt>{tUi("history_source_licence")}</dt>
                          <dd className="m-0">{licence}</dd>
                        </div>
                      ) : null}
                      {reference.recordId ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt>{tUi("history_source_record_id")}</dt>
                          <dd className="m-0 break-all">
                            {reference.recordId}
                          </dd>
                        </div>
                      ) : null}
                      {retrieved ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt>{tUi("history_source_retrieved")}</dt>
                          <dd className="m-0">{retrieved}</dd>
                        </div>
                      ) : null}
                      {supportedFields.length ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt>{tUi("history_source_supports")}</dt>
                          <dd className="m-0">
                            {supportedFields.map(fieldLabel).join(", ")}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          {[added, tUi("history_source_missing")].filter(Boolean).join(" · ")}
        </p>
      )}

      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{ background: T.bg.surface }}
      >
        <div className="min-w-0">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: checkedDate ? T.accent.ok : T.ink.base }}
          >
            {checkedDate
              ? tUi("history_last_checked_on", { date: checkedDate })
              : tUi("history_not_checked")}
          </p>
          {!checkedDate ? (
            <p className="m-0 mt-0.5 text-[13px]" style={{ color: T.ink.dim }}>
              {tUi("history_check_help")}
            </p>
          ) : null}
        </div>
        <OpenCorrectionLink className="shrink-0 rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white! hover:bg-(--t-accent-primary-hover)">
          {tUi("suggest_a_correction")}
        </OpenCorrectionLink>
      </div>

      {showActivity ? (
        <details className="mt-5">
          <summary
            className="w-fit cursor-pointer text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {tUi("history_activity")}
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-end">
            <ChangeHistogram
              months={months}
              verificationEvents={stats?.verificationEvents ?? []}
            />
            {most.length ? (
              <div className="md:pb-8">
                <h3
                  className="m-0 text-[14px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {tUi("history_most_updated")}
                </h3>
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                  {most.map((field) => (
                    <li
                      key={field.field}
                      className="rounded-full px-3 py-1 text-[13px]"
                      style={{ background: T.bg.muted, color: T.ink.base }}
                    >
                      {field.label} · {field.count}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {history && hasChanges ? (
        <div className="mt-5">
          <h3
            className="m-0 pb-2 text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {tUi("history_recent_changes")}
          </h3>
          <LibraryChangeTimeline
            documentId={library.documentId}
            initial={history}
          />
        </div>
      ) : (
        <p className="m-0 mt-4 text-[13px]" style={{ color: T.ink.dim }}>
          {tUi(
            !history
              ? "history_changes_unavailable"
              : source && source !== "manual"
                ? "history_no_changes_since_import"
                : "no_changes_yet"
          )}
        </p>
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
