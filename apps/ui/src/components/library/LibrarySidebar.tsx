// Sticky sidebar for the library detail page (v2): record, tasks and links.

import { Icon } from "@iconify/react"

import {
  type OpeningTimesValue,
  recordChecklist,
} from "@/components/library/library-page.helpers"
import {
  OpenCorrectionLink,
  OpenVerifyLink,
} from "@/components/library/LibraryCorrection"
import { LibraryFollowerCount } from "@/components/library/LibraryFollowerCount"
import {
  LibraryHelpPanel,
  type TranslateLocale,
} from "@/components/library/LibraryHelpPanel"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { StaffLibraryEntry } from "@/components/library/StaffLibraryEntry"
import {
  availableSections,
  verifyRecordOf,
} from "@/components/library/verify.logic"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type Lib = PopulatedLibraryData
const asRecord = (l: Lib) => l as unknown as Record<string, unknown>

const PANEL = "rounded-3xl p-5"
const panelStyle = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}

/** The sidebar's checklist, shared by the record panel and the tasks. */
export function libraryChecklist(library: Lib) {
  const rec = asRecord(library)

  return recordChecklist({
    heroImage: library.heroImage,
    openingTimes: library.openingTimes as OpeningTimesValue | null,
    streetAddress: library.streetAddress,
    location: library.location,
    accessibility: library.accessibility as unknown[] | null,
    services: library.services as unknown[] | null,
    amenities: library.amenities as unknown[] | null,
    absentFacilities: rec.absentFacilities,
    summary: library.summary,
    description: library.description,
    collectionStats: rec.collectionStats as unknown[] | null,
    foundedYear: rec.foundedYear as string | null,
    openedYear: rec.openedYear as string | null,
    website: rec.website as string | null,
    phone: rec.phone as string | null,
    email: rec.email as string | null,
  })
}

export function LibraryRecordPanel({
  library,
  followers = null,
}: {
  readonly library: Lib
  /** People following the library; null leaves the count out. */
  readonly followers?: number | null
}) {
  const rec = asRecord(library)
  const { done, total, items } = libraryChecklist(library)
  const reviewed =
    (rec.lastVerifiedAt as string | null) ?? (rec.updatedAt as string | null)

  return (
    <section aria-labelledby="rec-h" className={PANEL} style={panelStyle}>
      <h2
        id="rec-h"
        className="m-0 mb-3 text-[15px] font-bold"
        style={{ color: T.ink.base }}
      >
        About this record
      </h2>
      <div
        className="flex gap-2.5 rounded-2xl px-3 py-2.5 text-[13.5px] leading-normal"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
        }}
      >
        <span className="mt-0.5 shrink-0" style={{ color: T.ink.dim }}>
          <LibIcon d={LIB_ICONS.people} size={16} />
        </span>
        <p className="m-0" style={{ color: T.ink.dim }}>
          <strong style={{ color: T.ink.base }}>
            {rec.hasStaff
              ? "Maintained by library staff."
              : "Community maintained."}
          </strong>{" "}
          {rec.hasStaff
            ? "Verified staff keep this record up to date. Community suggestions are welcome."
            : "No verified staff yet. Changes are checked by reviewers against sources."}
        </p>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="m-0 text-[14px] font-bold" style={{ color: T.ink.base }}>
          Completeness
        </h3>
        <span
          className="text-[14px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {done} of {total}
        </span>
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-1">
        {items.map((item) => (
          <span
            key={item.key}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: item.done ? "var(--tint-public-fg)" : T.bg.muted2,
            }}
          />
        ))}
      </div>
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0 text-[13.5px]">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-1.5"
            style={{ color: item.done ? T.ink.base : T.ink.dim }}
          >
            <Icon
              aria-hidden="true"
              height={15}
              icon={item.done ? "mdi:check" : "mdi:circle-outline"}
              style={{
                color: item.done ? "var(--tint-public-fg)" : T.ink.low,
              }}
              width={15}
            />
            {item.label}
            <span className="sr-only">
              {item.done ? ": added" : ": not added yet"}
            </span>
          </li>
        ))}
      </ul>

      <p
        className="mt-4 mb-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]"
        style={{ color: T.ink.dim }}
      >
        <LibIcon d={LIB_ICONS.calendar} size={14} />
        {reviewed
          ? `Last reviewed ${new Date(reviewed).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`
          : "Not yet reviewed"}
        {followers !== null && library.documentId ? (
          <>
            <span aria-hidden="true">·</span>
            <LibraryFollowerCount
              initial={followers}
              libraryDocumentId={library.documentId}
            />
          </>
        ) : null}
      </p>
    </section>
  )
}

export function LibraryTasksPanel({
  library,
  facilityQuestions,
  translateLocales = [],
}: {
  readonly library: Lib
  readonly facilityQuestions: number
  /** Strapi's configured locales, for the "Translate this record" link. */
  readonly translateLocales?: readonly TranslateLocale[]
}) {
  const { items } = libraryChecklist(library)
  const gaps = items.filter((i) => !i.done).map((i) => i.key)
  const rec = asRecord(library)

  return (
    <LibraryHelpPanel
      facilityQuestions={facilityQuestions}
      gaps={gaps}
      libraryDocumentId={library.documentId ?? ""}
      libraryName={library.name ?? ""}
      librarySlug={library.slug ?? ""}
      libraryPlace={{
        city: library.city,
        regionName: library.region?.name,
      }}
      libraryWebsite={rec.website as string | null}
      translateLocales={translateLocales}
    />
  )
}

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function LibraryLinksPanel({ library }: { readonly library: Lib }) {
  const rec = asRecord(library)
  const website = (rec.website as string | null) ?? null
  const catalogueUrl = (rec.catalogueUrl as string | null) ?? null
  const hasContact = availableSections(verifyRecordOf(library)).includes(
    "contact"
  )
  const others: { href: string | null; label: string; icon: string }[] = [
    {
      href: (rec.membershipUrl as string | null) ?? null,
      label: "Join the library",
      icon: LIB_ICONS.people,
    },
    {
      href: (rec.bookingUrl as string | null) ?? null,
      label: "Book a visit",
      icon: LIB_ICONS.calendar,
    },
    {
      href: (rec.planVisitUrl as string | null) ?? null,
      label: "Plan your visit",
      icon: LIB_ICONS.pin,
    },
    {
      href: (rec.wikidataId as string | null)
        ? `https://www.wikidata.org/wiki/${rec.wikidataId as string}`
        : null,
      label: "Wikidata",
      icon: LIB_ICONS.db,
    },
  ]

  const missing = (label: string, icon: string) => (
    <li className="flex items-center gap-2" style={{ color: T.ink.dim }}>
      <LibIcon d={icon} size={16} />
      <span>
        {label} not added yet ·{" "}
        <OpenCorrectionLink
          category="Something else"
          className="underline underline-offset-2"
        >
          Add
        </OpenCorrectionLink>
      </span>
    </li>
  )

  const link = (href: string, label: string, icon: string) => (
    <li key={label} className="flex items-center gap-2">
      <span style={{ color: T.accent.primary }}>
        <LibIcon d={icon} size={16} />
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate font-semibold underline underline-offset-2"
        style={{ color: T.accent.primary }}
      >
        {label} ↗<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  )

  return (
    <section aria-labelledby="links-h" className={PANEL} style={panelStyle}>
      <h2
        id="links-h"
        className="m-0 mb-2.5 text-[15px] font-bold"
        style={{ color: T.ink.base }}
      >
        Official links
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
        {website
          ? link(website, hostname(website), LIB_ICONS.globe)
          : missing("Website", LIB_ICONS.globe)}
        {catalogueUrl
          ? link(catalogueUrl, "Search the catalogue", LIB_ICONS.book)
          : missing("Catalogue link", LIB_ICONS.book)}
        {others.flatMap((l) => (l.href ? [link(l.href, l.label, l.icon)] : []))}
      </ul>
      {hasContact ? (
        <p
          className="m-0 mt-3 border-t pt-3 text-[13.5px]"
          style={{ borderColor: T.border.divider, color: T.ink.dim }}
        >
          <OpenVerifyLink
            className="font-semibold underline underline-offset-2"
            sections={["contact"]}
          >
            Still right?
            <span className="sr-only"> Confirm the contact details</span>
          </OpenVerifyLink>
        </p>
      ) : null}
    </section>
  )
}

export function LibraryClaimNote({ library }: { readonly library: Lib }) {
  return (
    <StaffLibraryEntry
      libraryDocumentId={library.documentId ?? ""}
      libraryEntityRef={library.entityRef ?? undefined}
      libraryName={library.name ?? ""}
      librarySlug={library.slug ?? ""}
      libraryType={library.libraryType}
      hasActiveFeed={Boolean(asRecord(library).hasActiveFeed)}
    />
  )
}
