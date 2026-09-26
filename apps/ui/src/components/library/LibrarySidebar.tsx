// Sticky sidebar for the library detail page (v2): record panel + links.

import {
  computeCompleteness,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { LibraryClaimButton } from "@/components/library/LibraryClaimButton"
import LibraryMap from "@/components/library/LibraryMap"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type Lib = PopulatedLibraryData
const asRecord = (l: Lib) => l as unknown as Record<string, unknown>

function DtRow({
  icon,
  label,
  children,
}: {
  readonly icon: string
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <dt
        className="flex items-center gap-1.5 text-[14px]"
        style={{ color: T.ink.dim }}
      >
        <LibIcon d={icon} size={16} />
        {label}
      </dt>
      <dd className="mx-0 mt-1 mb-0 text-[16px]">{children}</dd>
    </div>
  )
}

export function LibraryRecordPanel({ library }: { readonly library: Lib }) {
  const rec = asRecord(library)
  const { filled, total } = computeCompleteness({
    heroImage: library.heroImage,
    openingTimes: library.openingTimes as OpeningTimesValue | null,
    streetAddress: library.streetAddress,
    location: library.location,
    accessibility: library.accessibility as unknown[] | null,
    services: library.services as unknown[] | null,
    amenities: library.amenities as unknown[] | null,
    description: library.description,
    summary: library.summary,
    collectionStats: rec.collectionStats as unknown[] | null,
    foundedYear: rec.foundedYear as string | null,
    openedYear: rec.openedYear as string | null,
    website: rec.website as string | null,
    phone: rec.phone as string | null,
    email: rec.email as string | null,
  })
  const pct = Math.round((filled / total) * 100)
  const lastVerifiedAt = rec.lastVerifiedAt as string | null
  const updatedAt = rec.updatedAt as string | null
  const reviewed = lastVerifiedAt ?? updatedAt

  return (
    <section
      aria-labelledby="rec-h"
      className="rounded-3xl p-[22px]"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <h2
        id="rec-h"
        className="m-0 mb-3.5 text-[18px] font-bold"
        style={{ color: T.ink.base }}
      >
        About this record
      </h2>
      <dl className="m-0 flex flex-col gap-3.5">
        <DtRow icon={LIB_ICONS.people} label="Record status">
          <span className="font-semibold">◐ Community maintained</span>
        </DtRow>
        <DtRow icon={LIB_ICONS.bars} label="Completeness">
          <span
            aria-hidden="true"
            className="block h-2 overflow-hidden rounded-full"
            style={{ background: T.border.divider }}
          >
            <span
              className="block h-full"
              style={{
                width: `${pct}%`,
                background: "var(--tint-public-fg)",
              }}
            />
          </span>
          <span className="mt-1.5 block text-[15px]">
            {filled} of {total} sections documented
          </span>
        </DtRow>
        <DtRow icon={LIB_ICONS.calendar} label="Last reviewed">
          {reviewed
            ? new Date(reviewed).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Not yet reviewed"}
        </DtRow>
      </dl>
      <div className="mt-4">
        <LibraryClaimButton
          libraryDocumentId={library.documentId ?? ""}
          librarySlug={library.slug ?? ""}
          libraryName={library.name ?? ""}
          libraryEntityRef={library.entityRef ?? undefined}
        />
      </div>
    </section>
  )
}

export function LibraryLinksPanel({ library }: { readonly library: Lib }) {
  const rec = asRecord(library)
  const candidates: { href: string | null; label: string; icon: string }[] = [
    {
      href: (rec.website as string | null) ?? null,
      label: "Website",
      icon: LIB_ICONS.globe,
    },
    {
      href: (rec.catalogueUrl as string | null) ?? null,
      label: "Catalogue",
      icon: LIB_ICONS.search,
    },
    {
      href: (rec.membershipUrl as string | null) ?? null,
      label: "Membership",
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
      href: (rec.sourceUrl as string | null) ?? null,
      label: "Source record",
      icon: LIB_ICONS.db,
    },
    {
      href: (rec.wikidataId as string | null)
        ? `https://www.wikidata.org/wiki/${rec.wikidataId as string}`
        : null,
      label: "Wikidata",
      icon: LIB_ICONS.db,
    },
  ]
  const links = candidates.flatMap((l) =>
    l.href ? [{ href: l.href, label: l.label, icon: l.icon }] : []
  )

  if (links.length === 0) return null

  const domain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return null
    }
  }

  return (
    <section
      aria-labelledby="links-h"
      className="rounded-3xl p-[22px]"
      style={{ background: "var(--tint-national-bg)" }}
    >
      <h2
        id="links-h"
        className="m-0 mb-2.5 text-[18px] font-bold"
        style={{ color: T.ink.base }}
      >
        Official links
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[16px] font-semibold">
        {links.map((l) => (
          <li
            key={l.label}
            className="flex items-center gap-2"
            style={{ color: T.accent.primary }}
          >
            <LibIcon d={l.icon} size={18} />
            <a href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
              {l.label === "Website" && domain(l.href)
                ? `: ${domain(l.href)}`
                : ""}{" "}
              ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LibraryMapPanel({ library }: { readonly library: Lib }) {
  if (!library.location) return null

  return (
    <section
      aria-label="Map"
      className="overflow-hidden rounded-3xl"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <LibraryMap library={library} className="h-64" />
    </section>
  )
}
