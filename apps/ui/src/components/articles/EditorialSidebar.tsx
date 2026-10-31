import { useLocale, useTranslations } from "next-intl"

import {
  journalHref,
  journalCollectionKey,
} from "@/components/blog/journalLanding.helpers"
import { JournalSavedLink } from "@/components/blog/JournalSaved"
import { MonthlyDispatchCard } from "@/components/blog/MonthlyDispatchCard"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import GlobalLink from "@/components/global/GlobalLink"
import type { JournalLandingData } from "@/lib/journal-landing"

export function JournalSidebar({
  data,
}: {
  readonly data: JournalLandingData
}) {
  const t = useTranslations("discovery")
  const ui = useTranslations("ui")
  const d = useTranslations("dashboard")
  const links = [
    ...(
      [
        ["allStories", "all"],
        ["fromIndex", "index"],
        ["communityJournal", "community"],
      ] as const
    ).map(([label, origin]) => ({
      href: journalHref(data.query, {
        filters: {
          ...data.query.filters,
          origins: origin === "all" ? [] : [origin],
        },
        allOrigins: origin === "all",
        saved: false,
      }),
      label: t(label),
      count:
        origin === "all"
          ? data.discovery.facets.origins.reduce(
              (sum, row) => sum + row.count,
              0
            )
          : data.discovery.facets.origins.find((row) => row.value === origin)
              ?.count,
      active:
        !data.query.saved &&
        label === journalCollectionKey(data.discovery.appliedFilters.origins),
    })),
  ]

  return (
    <div className="editorial-sidebar">
      <p className="record-nav-label">{d("browse")}</p>
      <nav aria-label={`${ui("journal")} · ${t("origins")}`}>
        {links.map((link) => (
          <GlobalLink
            key={link.href}
            href={link.href}
            aria-current={link.active ? "page" : undefined}
          >
            <span>{link.label}</span>
            <span>{link.count}</span>
          </GlobalLink>
        ))}
        <JournalSavedLink query={data.query} />
      </nav>
      <p className="record-nav-label">{t("sections")}</p>
      <nav aria-label={t("sections")}>
        {data.sections.map((section) => (
          <GlobalLink
            key={section.slug}
            href={journalHref(data.query, { section: section.slug })}
            aria-current={
              data.query.section === section.slug ? "page" : undefined
            }
          >
            <span>{section.name}</span>
            <span>{section.count}</span>
          </GlobalLink>
        ))}
      </nav>
      {data.discovery.facets.authors.length ? (
        <>
          <p className="record-nav-label">{t("authors")}</p>
          <nav aria-label={t("authors")}>
            {data.discovery.facets.authors.slice(0, 6).map((author) => (
              <GlobalLink
                key={author.value}
                href={journalHref(data.query, {
                  filters: { ...data.query.filters, authors: [author.value] },
                })}
              >
                <span>{author.label}</span>
                <span>{author.count}</span>
              </GlobalLink>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  )
}
export function JournalSidebarFooter() {
  return (
    <div className="editorial-sidebar-footer">
      <MonthlyDispatchCard />
    </div>
  )
}

export function KnowledgeSidebarFooter({
  slug,
  contentLocale,
}: {
  readonly slug?: string
  readonly contentLocale?: string
}) {
  const interfaceLocale = useLocale()
  const language = contentLocale ?? interfaceLocale
  const t = useTranslations("editorial")
  const p = useTranslations("publishing")

  return (
    <DashboardSidebarCta
      title={slug ? t("outOfDate") : t("missingGuide")}
      body={slug ? p("maintenanceHint") : t("missingGuideLead")}
      action={{
        label: slug ? p("suggestImprovement") : t("suggestGuide"),
        href: slug
          ? `/contribute/knowledge/${encodeURIComponent(slug)}?mode=report&locale=${encodeURIComponent(language)}&sourceLocale=${encodeURIComponent(language)}`
          : "/contribute/knowledge",
      }}
    />
  )
}
