import { type LibraryNotice, libraryTypeName } from "@repo/shared-data"
import { useTranslations } from "next-intl"

import {
  toLatLng,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import {
  analyticsAttributes,
  type AnalyticsParameters,
} from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

const NON_PHYSICAL_TYPES = new Set<string | null>(["Mobile", "Digital"])

export function LibraryVisitRail({
  library,
  embedded = false,
}: {
  readonly embedded?: boolean
  readonly library: PopulatedLibraryData
}) {
  const t = useTranslations("libraryPage")
  const rec = library as unknown as Record<string, unknown>
  const type = libraryTypeName(library.libraryType)
  const coords = toLatLng(library.location)
  const physical = !NON_PHYSICAL_TYPES.has(type)
  const headings = { Digital: "onlineAccess", Mobile: "planJourney" } as const
  const headingKey = headings[type as keyof typeof headings] ?? "planVisit"
  const operator = [rec.operatorName, rec.operatorType]
    .filter(
      (value): value is string =>
        typeof value === "string" && Boolean(value.trim())
    )
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" · ")
  const links = (
    [
      ["website", library.website],
      ["catalogue", rec.catalogueUrl],
      ["planVisit", rec.planVisitUrl],
      ["membership", rec.membershipUrl],
      ["booking", rec.bookingUrl],
      ["digitalCollections", rec.iiifEndpoint],
      [
        "wikidata",
        rec.wikidataId
          ? `https://www.wikidata.org/wiki/${String(rec.wikidataId)}`
          : null,
      ],
    ] as const
  )
    .flatMap(([label, href]) =>
      typeof href === "string" && /^https?:\/\//i.test(href)
        ? [{ label, href }]
        : []
    )
    .filter(
      (link, index, all) =>
        all.findIndex((item) => item.href === link.href) === index
    )
  const measure = (action_type: AnalyticsParameters["action_type"]) =>
    analyticsAttributes("library_action", {
      action_type,
      interaction_source: "library_sidebar",
      library_document_id: library.documentId,
    })
  const linkActions = {
    website: "website",
    catalogue: "catalogue",
    planVisit: "plan_visit",
    membership: "join",
    booking: "booking",
  } as const
  const measureLink = (label: string) =>
    label in linkActions
      ? measure(linkActions[label as keyof typeof linkActions])
      : {}
  const action =
    "flex min-h-11 items-center justify-between gap-3 border-t border-(--t-border-line) py-2.5 text-sm font-semibold no-underline hover:text-(--t-accent-primary)"

  const Tag = embedded ? "div" : "section"

  return (
    <Tag
      className={embedded ? "library-visit-actions" : "record-support-card"}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby={embedded ? undefined : "visit-rail-heading"}
    >
      {!embedded ? (
        <h2 id="visit-rail-heading" className="type-small-heading m-0">
          {t(headingKey)}
        </h2>
      ) : null}
      {physical ? (
        <div className="mt-3">
          <LibraryOpenStatusBadge
            openingTimes={library.openingTimes as OpeningTimesValue | null}
            timezone={typeof rec.timezone === "string" ? rec.timezone : null}
            notices={rec.notices as LibraryNotice[] | undefined}
            operationalStatus={library.operationalStatus}
          />
        </div>
      ) : null}
      <div className="mt-4 grid">
        {physical && coords ? (
          <a
            className={action}
            {...measure("directions")}
            href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("directions")} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {type === "Mobile" ? (
          <a className={action} href="#stops">
            {t("stops")} <span aria-hidden="true">↓</span>
          </a>
        ) : null}
        {library.phone ? (
          <a className={`${action} break-all`} href={`tel:${library.phone}`}>
            {t("call")}{" "}
            <span className="text-right font-normal">{library.phone}</span>
          </a>
        ) : null}
        {library.email ? (
          <a className={action} href={`mailto:${library.email}`}>
            {t("email")} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {links.slice(0, 3).map((link) => (
          <a
            key={link.href}
            className={action}
            href={link.href}
            {...measureLink(link.label)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(link.label)} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      {links.length > 3 ? (
        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
            {t("allLinks", { count: links.length })}
          </summary>
          <div className="grid gap-1">
            {links.slice(3).map((link) => (
              <a
                key={link.href}
                className={action}
                href={link.href}
                {...measureLink(link.label)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(link.label)} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </details>
      ) : null}
      <a className="network-page-link mt-2 text-sm" href="#contribute">
        {t("improve")}
      </a>
      {operator ? (
        <p
          className="mt-3 mb-0 border-t pt-3 text-xs leading-relaxed"
          style={{ color: T.ink.dim, borderColor: T.border.line }}
        >
          {t("runBy", { name: operator })}
        </p>
      ) : null}
    </Tag>
  )
}
