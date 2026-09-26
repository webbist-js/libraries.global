// Server-rendered content sections for the library detail page (v2).

import {
  formatCoordinates,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { LibraryCopyButton } from "@/components/library/LibraryCopyButton"
import { LibraryHoursTable } from "@/components/library/LibraryHoursTable"
import {
  LIB_ICONS,
  LibIcon,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type Lib = PopulatedLibraryData
const asRecord = (l: Lib) => l as unknown as Record<string, unknown>

function externalLink(href: string, label: string) {
  return (
    <a
      key={href}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold"
    >
      {label} ↗
    </a>
  )
}

// ── Visit ────────────────────────────────────────────────────────────────────

export function LibraryVisitSection({ library }: { readonly library: Lib }) {
  const rec = asRecord(library)
  const coords = formatCoordinates(
    library.location as { lat?: unknown; lng?: unknown } | null
  )
  const addressLines = [
    library.streetAddress,
    [library.city, library.postalCode].filter(Boolean).join(" "),
    library.country?.name,
  ].filter(Boolean) as string[]
  const fullAddress = addressLines.join(", ")
  const loc = library.location as { lat?: number; lng?: number } | null
  const directionsUrl =
    loc?.lat != null && loc?.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
      : null
  const transitInfo = rec.transitInfo as string | null
  const timezone = (rec.timezone as string | null) ?? null
  const openingTimes =
    (library.openingTimes as OpeningTimesValue | null) ?? null
  const lastVerifiedAt = rec.lastVerifiedAt as string | null

  return (
    <LibrarySectionCard id="visit" title="Visit" iconPath={LIB_ICONS.pin}>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3
            className="mb-2 flex items-center gap-1.5 text-[16px] font-bold"
            style={{ color: T.ink.base }}
          >
            <LibIcon d={LIB_ICONS.pin} />
            Address
          </h3>
          {addressLines.length > 0 ? (
            <address className="text-[17px] leading-relaxed not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          ) : (
            <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
              Address not added yet.
            </p>
          )}
          {coords ? (
            <p
              className="mt-2 mb-0 text-[13px]"
              style={{ fontFamily: T.font.mono, color: T.ink.dim }}
            >
              {coords}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3.5 text-[16px] font-semibold">
            {directionsUrl
              ? externalLink(directionsUrl, "Get directions")
              : null}
            {fullAddress ? <LibraryCopyButton text={fullAddress} /> : null}
          </div>
          {(rec.nearestStation as string | null) ? (
            <p className="mt-3.5 mb-0 flex flex-wrap items-center gap-2 text-[16px] leading-normal">
              <LibIcon d={LIB_ICONS.train} size={18} />
              <strong>Nearest station:</strong> {rec.nearestStation as string}
            </p>
          ) : null}
          {transitInfo ? (
            <p className="mt-3.5 mb-0 flex flex-wrap items-center gap-2 text-[16px] leading-normal">
              <LibIcon d={LIB_ICONS.train} size={18} />
              <strong>Getting there:</strong> {transitInfo}
            </p>
          ) : null}
        </div>
        <div>
          <h3
            className="mb-2 flex flex-wrap items-center gap-1.5 text-[16px] font-bold"
            style={{ color: T.ink.base }}
          >
            <LibIcon d={LIB_ICONS.clock} />
            Opening hours{" "}
            {timezone ? (
              <span className="font-normal" style={{ color: T.ink.dim }}>
                ({timezone})
              </span>
            ) : null}
          </h3>
          <LibraryHoursTable openingTimes={openingTimes} timezone={timezone} />
          <p
            className="mt-2.5 mb-0 text-[14px] leading-normal"
            style={{ color: T.ink.dim }}
          >
            {lastVerifiedAt
              ? `Checked ${new Date(lastVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by a contributor. `
              : "Not yet verified by a contributor. "}
            No temporary closures reported.
          </p>
        </div>
      </div>
    </LibrarySectionCard>
  )
}

// ── Accessibility & facilities ───────────────────────────────────────────────

const FACILITY_CHECKLIST = [
  "Step-free entrance",
  "Accessible toilets",
  "Hearing loop",
  "Quiet study space",
  "Wi-Fi",
  "Public computers",
  "Café",
  "Large-print materials",
]

export function LibraryFacilitiesSection({
  library,
}: {
  readonly library: Lib
}) {
  type TagItem = { name?: string | null; summary?: string | null }
  const documented = [
    ...((library.accessibility ?? []) as TagItem[]),
    ...((library.services ?? []) as TagItem[]),
    ...((library.amenities ?? []) as TagItem[]),
  ]
    .map((i) => i.name)
    .filter(Boolean) as string[]

  const normalized = new Set(documented.map((n) => n.toLowerCase()))
  const missing = FACILITY_CHECKLIST.filter(
    (item) =>
      ![...normalized].some(
        (doc) =>
          doc.includes(item.toLowerCase()) || item.toLowerCase().includes(doc)
      )
  )

  const rows = [
    ...documented.map((label) => ({ label, documented: true })),
    ...missing.map((label) => ({ label, documented: false })),
  ]

  return (
    <LibrarySectionCard
      id="access"
      title="Accessibility & facilities"
      iconPath={LIB_ICONS.access}
      intro="Please check with the library before visiting if something matters to you."
    >
      <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
        {rows.map(({ label, documented: isDocumented }) => (
          <li
            key={label}
            className="flex items-center gap-3 py-2.5 text-[16px]"
            style={{ borderBottom: `1px solid ${T.border.divider}` }}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
              style={{
                background: isDocumented
                  ? "var(--tint-public-bg)"
                  : "var(--tint-neutral-bg)",
                color: isDocumented
                  ? "var(--tint-public-fg)"
                  : "var(--tint-neutral-fg)",
              }}
            >
              <LibIcon d={LIB_ICONS.access} size={19} />
            </span>
            <span className="flex-1">{label}</span>
            <span
              className="text-[15px] font-semibold"
              style={{
                color: isDocumented
                  ? "var(--tint-public-fg)"
                  : "var(--tint-neutral-fg)",
              }}
            >
              {isDocumented ? "✓ Yes" : "? Not documented"}
            </span>
          </li>
        ))}
      </ul>
      <a href="#correct" className="mt-3.5 inline-block font-semibold">
        Add missing accessibility details
      </a>
    </LibrarySectionCard>
  )
}

// ── Collections ──────────────────────────────────────────────────────────────

export function LibraryCollectionsSection({
  library,
}: {
  readonly library: Lib
}) {
  const rec = asRecord(library)
  const description = library.description as unknown[] | null
  const summary = library.summary as string | null
  const collectionStats = (rec.collectionStats ?? []) as {
    value: string
    category?: string | null
    description?: string | null
  }[]
  const catalogueUrl = rec.catalogueUrl as string | null
  const iiifEndpoint = rec.iiifEndpoint as string | null

  const hasContent =
    Boolean(summary) ||
    (Array.isArray(description) && description.length > 0) ||
    collectionStats.length > 0 ||
    Boolean(catalogueUrl) ||
    Boolean(iiifEndpoint)

  return (
    <LibrarySectionCard
      id="collections"
      title="Collections"
      iconPath={LIB_ICONS.book}
      dashed={!hasContent}
    >
      {Array.isArray(description) && description.length > 0 ? (
        <div className="max-w-[68ch] text-[18px] leading-relaxed">
          <StrapiBlocksContent
            blocks={
              description as Parameters<typeof StrapiBlocksContent>[0]["blocks"]
            }
          />
        </div>
      ) : summary ? (
        <p className="m-0 max-w-[68ch] text-[18px] leading-relaxed">
          {summary}
        </p>
      ) : (
        <p
          className="m-0 text-[17px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          Collections not yet documented. Know this library?{" "}
          <a href="#correct">Add a description</a>.
        </p>
      )}

      {collectionStats.length > 0 ? (
        <>
          <h3
            className="mt-5 mb-2.5 text-[16px] font-bold"
            style={{ color: T.ink.base }}
          >
            Highlights
          </h3>
          <ul className="m-0 grid gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
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
                <span
                  className="block text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  {stat.category ?? stat.description ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {catalogueUrl || iiifEndpoint ? (
        <div className="mt-4 flex flex-wrap gap-3.5 font-semibold">
          {catalogueUrl
            ? externalLink(catalogueUrl, "Search the catalogue")
            : null}
          {iiifEndpoint
            ? externalLink(iiifEndpoint, "Digitised collections")
            : null}
        </div>
      ) : null}
    </LibrarySectionCard>
  )
}

// ── History ──────────────────────────────────────────────────────────────────

export function LibraryHistorySection({ library }: { readonly library: Lib }) {
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
        ? `Building opened${buildingInfo ? ` — ${buildingInfo}` : ""}, designed by ${architect}.`
        : "Building opened to readers.",
    })
  if (closedYear) entries.push({ year: closedYear, text: "Closed." })
  if (!openedYear && (architect || buildingInfo)) {
    entries.push({
      year: "—",
      text: [buildingInfo, architect ? `Architect: ${architect}` : null]
        .filter(Boolean)
        .join(" · "),
    })
  }

  if (entries.length === 0) return null

  return (
    <LibrarySectionCard id="history" title="History" iconPath={LIB_ICONS.clock}>
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-4">
            <span
              className="min-w-16 text-[24px]"
              style={{ fontFamily: T.font.serif, color: T.accent.primary }}
            >
              {e.year}
            </span>
            <span className="text-[17px] leading-normal">{e.text}</span>
          </li>
        ))}
      </ol>
    </LibrarySectionCard>
  )
}

// ── Sources & record history ─────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  libraryon: "libraryOn (British Library)",
  wikidata: "Wikidata",
  manual: "a contributor",
}

const REVISION_KIND_META: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  edit: {
    label: "Edit",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
  },
  addition: {
    label: "Added",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
  },
  import: {
    label: "Import",
    bg: "var(--tint-neutral-bg)",
    fg: "var(--tint-neutral-fg)",
  },
  steward: {
    label: "Steward",
    bg: "var(--tint-national-bg)",
    fg: "var(--tint-national-fg)",
  },
}

export interface LibraryRevisionItem {
  kind: string
  summary: string
  submittedByUsername: string | null
  decidedAt: string | null
}

export function LibrarySourcesSection({
  library,
  revisions = [],
}: {
  readonly library: Lib
  readonly revisions?: readonly LibraryRevisionItem[]
}) {
  const rec = asRecord(library)
  const source = rec.source as string | null
  const sourceUrl = rec.sourceUrl as string | null
  const lastVerifiedAt = rec.lastVerifiedAt as string | null
  const createdAt = rec.createdAt as string | null
  const website = rec.website as string | null

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null

  return (
    <LibrarySectionCard
      id="sources"
      title="Sources & history of this record"
      iconPath={LIB_ICONS.list}
    >
      <ul className="m-0 pl-5 text-[16px] leading-loose">
        {source ? (
          <li>
            Imported from{" "}
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                {SOURCE_LABELS[source] ?? source}
              </a>
            ) : (
              (SOURCE_LABELS[source] ?? source)
            )}
            {fmt(createdAt) ? `, ${fmt(createdAt)}` : ""}
          </li>
        ) : (
          <li>
            Created by a contributor
            {fmt(createdAt) ? `, ${fmt(createdAt)}` : ""}
          </li>
        )}
        {website ? (
          <li>
            Details:{" "}
            <a href={website} target="_blank" rel="noopener noreferrer">
              official website
            </a>
            {lastVerifiedAt
              ? `, checked ${fmt(lastVerifiedAt)}`
              : ", not yet verified"}
          </li>
        ) : null}
      </ul>

      {revisions.length > 0 ? (
        <>
          <h3
            className="mt-5 mb-2 text-[16px] font-bold"
            style={{ color: T.ink.base }}
          >
            Recent changes
          </h3>
          <ol className="m-0 list-none p-0">
            {revisions.map((r, i) => {
              const meta =
                REVISION_KIND_META[r.kind] ?? REVISION_KIND_META.edit!

              return (
                <li
                  key={`${r.decidedAt ?? i}-${r.summary}`}
                  className="flex flex-wrap items-center gap-2.5 py-2.5"
                  style={{
                    borderTop: i > 0 ? `1px solid ${T.border.divider}` : "none",
                  }}
                >
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px]">
                    {r.summary}
                    {r.submittedByUsername ? (
                      <>
                        {" · "}
                        <a href={`/profile/${r.submittedByUsername}`}>
                          {r.submittedByUsername}
                        </a>
                      </>
                    ) : null}
                  </span>
                  {r.decidedAt ? (
                    <span className="text-[14px]" style={{ color: T.ink.dim }}>
                      {fmt(r.decidedAt)}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </>
      ) : null}
    </LibrarySectionCard>
  )
}
