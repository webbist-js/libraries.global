// Server-rendered content sections for the library detail page (v2).

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
import { LibraryAboutDisclosure } from "@/components/library/LibraryAboutDisclosure"
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
    <div
      className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed"
      style={{
        background:
          // eslint-disable-next-line react-hooks/purity -- This server component evaluates freshness at request time, with no client render.
          !checkedAt || Date.now() - Date.parse(checkedAt) > 730 * 86_400_000
            ? "#FFF5E5"
            : T.bg.space,
        color: T.ink.dim,
      }}
    >
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
      <div className="mt-3 flex flex-wrap gap-2">
        {hasHours && canVerify ? (
          <OpenVerifyLink
            className="inline-flex min-h-11 items-center rounded-full border bg-white px-3 font-semibold"
            sections={["hours", "status"]}
          >
            These are right
            <span className="sr-only">
              {" "}
              Confirm the opening hours and open status
            </span>
          </OpenVerifyLink>
        ) : null}
        {hasHours ? (
          <OpenCorrectionLink
            category="Opening hours"
            className="inline-flex min-h-11 items-center rounded-full border bg-white px-3 font-semibold"
          >
            Something’s changed
          </OpenCorrectionLink>
        ) : null}
      </div>
    </div>
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

  if (library.libraryType === "Digital")
    return (
      <LibrarySectionCard
        id="visit"
        title="Online access"
        iconPath={LIB_ICONS.pin}
      >
        <p>
          Use the official website or catalogue to access this library’s
          resources.
        </p>
        {(["admissionInfo", "visitNotes"] as const).map((key) =>
          typeof rec[key] === "string" && rec[key] ? (
            <p key={key}>{String(rec[key])}</p>
          ) : null
        )}
        {library.website ? (
          <a className={LINK} href={library.website}>
            Visit the official website
          </a>
        ) : (
          <OpenCorrectionLink category="Something else" className={LINK}>
            Add an access link
          </OpenCorrectionLink>
        )}
      </LibrarySectionCard>
    )

  return (
    <LibrarySectionCard
      id="visit"
      title={tUi("visit")}
      iconPath={LIB_ICONS.pin}
    >
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="md:order-2">
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
          {(["admissionInfo", "visitNotes"] as const).map((field) =>
            typeof rec[field] === "string" && rec[field] ? (
              <div key={field} className="mt-4 text-sm leading-relaxed">
                <p className="m-0">
                  <strong>
                    {field === "admissionInfo"
                      ? "Admission: "
                      : "Before you visit: "}
                  </strong>
                  {String(rec[field]).length > 260
                    ? String(rec[field])
                        .slice(0, 220)
                        .replace(/\s+\S*$/, "") + "…"
                    : String(rec[field])}
                </p>
                {String(rec[field]).length > 260 ? (
                  <details className="mt-2">
                    <summary className="flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4">
                      {field === "admissionInfo"
                        ? "Full admission and reader-card requirements"
                        : "Read all visitor information"}
                    </summary>
                    <p className="mt-2">{String(rec[field])}</p>
                  </details>
                ) : null}
              </div>
            ) : null
          )}
          {library.phone || library.email ? (
            <p className="mt-4 flex flex-wrap gap-4 text-sm">
              {library.phone ? (
                <a className={LINK} href={`tel:${library.phone}`}>
                  {library.phone}
                </a>
              ) : null}
              {library.email ? (
                <a className={LINK} href={`mailto:${library.email}`}>
                  {library.email}
                </a>
              ) : null}
            </p>
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

        <div className="order-first md:order-1">
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

  const rec = asRecord(library)
  const rows = facilityRows(library).filter((row) => row.category !== "service")
  const unknown = rows.filter((r) => r.state === "unknown").length
  const known = rows.filter((row) => row.state !== "unknown").length
  const intro =
    known === 0 ? (
      "None of these are documented yet. Know the answer? Tap Yes or No."
    ) : unknown > 0 ? (
      `${known} of ${rows.length} answered. “Not recorded” means no one has told us yet, not that it’s unavailable. Know an answer? Choose Yes, No or Not sure.`
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
      title={
        library.libraryType === "Mobile"
          ? "Onboard accessibility and facilities"
          : "Accessibility & facilities"
      }
      iconPath={LIB_ICONS.access}
      intro={intro}
    >
      {typeof rec.accessibilityNotes === "string" && rec.accessibilityNotes ? (
        <p className="mb-4 text-sm leading-relaxed">{rec.accessibilityNotes}</p>
      ) : null}
      <LibraryFacilityAnswers
        grouped
        libraryDocumentId={library.documentId}
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
export function historyEntries(
  library: Lib,
  { compact = false }: { compact?: boolean } = {}
): { year: string; text: string }[] {
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
      text: compact
        ? "Building opened."
        : architect
          ? `Building opened, designed by ${architect}.`
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
    ((rec.libraryStats as unknown[] | null)?.length ?? 0) > 0 ||
    Boolean(rec.catalogueUrl) ||
    Boolean(rec.iiifEndpoint) ||
    Boolean(rec.buildingInfo) ||
    Boolean(rec.architect) ||
    Boolean(rec.operatorName) ||
    Boolean(rec.operatorType) ||
    historyEntries(library).length > 0
  )
}

export function LibraryCollectionsSection({
  library,
  footer,
}: {
  readonly footer?: React.ReactNode
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
  const collectionStats = (
    (rec.collectionStats ?? []) as {
      value: string
      category?: string | null
      description?: string | null
    }[]
  ).filter((stat) => stat?.value)
  const libraryStats = (
    (rec.libraryStats ?? []) as {
      value: string
      label: string
      note?: string | null
    }[]
  ).filter((stat) => stat?.value && stat?.label)
  const textField = (key: string) =>
    typeof rec[key] === "string" ? rec[key].trim() || null : null
  const catalogueUrl = textField("catalogueUrl")
  const iiifEndpoint = textField("iiifEndpoint")
  const buildingInfo = textField("buildingInfo")
  const architect = textField("architect")
  const operator = [textField("operatorName"), textField("operatorType")]
    .filter(Boolean)
    .join(" · ")
  const timeline = historyEntries(library, { compact: true }).filter(
    (entry) => entry.year
  )
  const hasDescription = Array.isArray(description) && description.length > 0
  const firstNote = collectionStats[0]?.description?.trim()
  const commonCollectionNote =
    firstNote &&
    collectionStats.every((stat) => stat.description?.trim() === firstNote)
      ? firstNote
      : null
  let buildingPreview = buildingInfo
  if (buildingInfo && buildingInfo.length > 320) {
    const start = buildingInfo.slice(0, 320)
    const sentenceEnd = start.lastIndexOf(". ")
    buildingPreview =
      sentenceEnd > 160
        ? start.slice(0, sentenceEnd + 1)
        : start.slice(0, start.lastIndexOf(" ")) + "…"
  }
  const hasLongBuilding = buildingPreview !== buildingInfo
  const hasMore = hasDescription || hasLongBuilding
  const visitorsOnly =
    libraryStats.length > 0 &&
    libraryStats.every((stat) =>
      /visit|member|attendance|reader/i.test(stat.label)
    )

  return (
    <LibrarySectionCard
      id="about"
      title="About and collections"
      titleClassName="text-[30px] sm:text-[34px]"
      iconPath={LIB_ICONS.book}
      tone="neutral"
    >
      <span id="collections" className="scroll-mt-24" />
      <div className="flex flex-col gap-[18px]">
        {summary ? (
          <p className="m-0 max-w-[68ch] text-[17px] leading-[1.65] text-pretty">
            {summary}
          </p>
        ) : null}

        {timeline.length > 0 ? (
          <ol
            id="history"
            aria-label="Library timeline"
            className="m-0 grid scroll-mt-24 list-none gap-2.5 p-0"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
            }}
          >
            {timeline.map((entry, index) => (
              <li
                key={index}
                className="border-l-2 py-0.5 pl-3"
                style={{ borderColor: "var(--tint-special-fg)" }}
              >
                <p
                  className="m-0 text-[24px] leading-tight"
                  style={{
                    fontFamily: T.font.serif,
                    color: "var(--tint-special-fg)",
                  }}
                >
                  {entry.year}
                </p>
                <p
                  className="mt-0.5 mb-0 text-[14px] leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  {entry.text}
                </p>
              </li>
            ))}
          </ol>
        ) : null}

        {collectionStats.length > 0 ? (
          <dl
            aria-label="Collection figures"
            className="m-0 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {collectionStats.map((stat, index) => (
              <div
                key={index}
                className="flex flex-col rounded-[14px] px-3.5 py-3"
                style={{ background: T.bg.surface }}
              >
                <dt
                  className="order-2 mt-0.5 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  {stat.category ?? "Collection figure"}
                </dt>
                <dd
                  className="order-1 m-0 text-[26px] leading-tight"
                  style={{ fontFamily: T.font.serif, color: T.ink.base }}
                >
                  {stat.value}
                </dd>
                {!commonCollectionNote && stat.description ? (
                  <dd
                    className="order-3 mt-2 mb-0 text-[13px] leading-normal"
                    style={{ color: T.ink.dim }}
                  >
                    {stat.description}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}
        {commonCollectionNote ? (
          <p
            className="m-0 text-[13px] leading-normal"
            style={{ color: T.ink.dim }}
          >
            {commonCollectionNote}
          </p>
        ) : null}

        {buildingInfo || architect || operator ? (
          <dl
            id="building"
            className={`m-0 grid scroll-mt-24 grid-cols-1 gap-3.5 text-[15px] leading-[1.5] ${operator && (buildingInfo || architect) ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
          >
            {buildingInfo || architect ? (
              <div>
                <dt className="font-bold">The building</dt>
                <dd className="mt-0.5 mb-0" style={{ color: T.ink.dim }}>
                  {buildingPreview ? (
                    <p className="m-0">{buildingPreview}</p>
                  ) : null}
                  {architect && !buildingPreview?.includes(architect) ? (
                    <p className={buildingPreview ? "mt-2 mb-0" : "m-0"}>
                      Architect: {architect}
                    </p>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {operator ? (
              <div>
                <dt className="font-bold">Run by</dt>
                <dd className="mt-0.5 mb-0" style={{ color: T.ink.dim }}>
                  {operator}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {libraryStats.length > 0 ? (
          <section
            aria-label={visitorsOnly ? "Visitors" : "Library figures"}
            className="border-t pt-4"
            style={{ borderColor: T.border.divider }}
          >
            <h3 className="m-0 mb-3 text-[15px] font-semibold">
              {visitorsOnly ? "Visitors" : "Library figures"}
            </h3>
            <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {libraryStats.map((stat, index) => (
                <div key={index}>
                  <dt
                    className="text-[14px] font-medium"
                    style={{ color: T.ink.dim }}
                  >
                    {stat.label}
                  </dt>
                  <dd
                    className="m-0 mt-1 text-[23px] leading-tight"
                    style={{ fontFamily: T.font.serif }}
                  >
                    {stat.value}
                  </dd>
                  {stat.note ? (
                    <dd
                      className="m-0 mt-1 text-[12.5px] leading-relaxed"
                      style={{ color: T.ink.dim }}
                    >
                      {stat.note}
                    </dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {hasMore || catalogueUrl || iiifEndpoint ? (
          <LibraryAboutDisclosure
            title={
              library.name ? `About ${library.name}` : "History and collections"
            }
            label={
              timeline.length > 0
                ? "Read the full history"
                : "Read more about the library"
            }
            links={
              <>
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
              </>
            }
          >
            {hasMore ? (
              <>
                {hasLongBuilding ? (
                  <div className={hasDescription ? "mb-5" : undefined}>
                    <h3
                      className="mt-0 mb-2 text-[16px] font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      The building
                    </h3>
                    <p className="m-0">{buildingInfo}</p>
                  </div>
                ) : null}
                {hasDescription ? (
                  <StrapiBlocksContent
                    blocks={
                      description as Parameters<
                        typeof StrapiBlocksContent
                      >[0]["blocks"]
                    }
                  />
                ) : null}
              </>
            ) : null}
          </LibraryAboutDisclosure>
        ) : null}
        {footer ? (
          <div
            className="border-t pt-3.5"
            style={{ borderColor: T.border.divider }}
          >
            {footer}
          </div>
        ) : null}
      </div>
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
  inline = false,
}: {
  readonly documentId: string
  readonly inline?: boolean
  readonly librarySlug: string
  readonly libraryName: string
}) {
  const tUi = useUiTranslations("ui")

  if (inline)
    return (
      <div
        id="events"
        className="flex scroll-mt-32 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[15px]"
        style={{ color: T.ink.dim }}
      >
        <p className="m-0">
          <strong style={{ color: T.ink.base }}>Events:</strong> none listed
          yet; no events feed connected.
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <OpenCorrectionLink
            category="Something else"
            className="inline-flex min-h-11 items-center text-[14px] underline underline-offset-[3px]"
          >
            Add a key date
          </OpenCorrectionLink>
          <span aria-hidden="true">·</span>
          <LibraryEventsEmptyAction
            documentId={documentId}
            libraryName={libraryName}
            librarySlug={librarySlug}
          />
        </div>
      </div>
    )

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
  reuseUrl,
}: {
  readonly library: Lib
  readonly reuseUrl?: string
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
      title={reuseUrl ? "Sources and reuse" : tUi("history_and_sources")}
      iconPath={LIB_ICONS.clock}
      tone="neutral"
    >
      <div className={reuseUrl ? "grid items-start gap-6 md:grid-cols-2" : ""}>
        <div>
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
                  ? reference.fields.filter(
                      (field) => typeof field === "string"
                    )
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
                        <p
                          className="m-0 text-[13px]"
                          style={{ color: T.ink.dim }}
                        >
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
              {[added, tUi("history_source_missing")]
                .filter(Boolean)
                .join(" · ")}
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
                <p
                  className="m-0 mt-0.5 text-[13px]"
                  style={{ color: T.ink.dim }}
                >
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
        </div>
        {reuseUrl ? (
          <LibraryReuseSection library={library} url={reuseUrl} embedded />
        ) : null}
      </div>
    </LibrarySectionCard>
  )
}

// ── Cite or reuse ────────────────────────────────────────────────────────────

const REUSE_PILL =
  "inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

export function LibraryReuseSection({
  library,
  url,
  embedded = false,
}: {
  readonly library: Lib
  readonly embedded?: boolean
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
      className={
        embedded
          ? "grid scroll-mt-32 gap-4"
          : "grid scroll-mt-32 gap-6 rounded-3xl p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center"
      }
      style={
        embedded
          ? undefined
          : { background: T.bg.space, border: `1px solid ${T.border.line}` }
      }
    >
      <div>
        <h2
          id="reuse-h"
          className={
            embedded
              ? "sr-only"
              : "m-0 text-[26px] leading-tight sm:text-[28px]"
          }
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
