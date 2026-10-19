import { useTranslations } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import {
  journalCollectionKey,
  journalHref,
} from "@/components/blog/journalLanding.helpers"
import { JournalListControls } from "@/components/blog/JournalListControls"
import { SectionNavigation } from "@/components/ds/SectionNavigation"
import { SectionTabs } from "@/components/ds/SectionTabs"
import type { JournalLandingData } from "@/lib/journal-landing"

export function JournalToolbar({
  data,
}: {
  readonly data: JournalLandingData
}) {
  const t = useTranslations("discovery")
  const { query, discovery, sections } = data
  const origins = discovery.facets.origins

  return (
    <SectionNavigation>
      <SectionTabs
        activeId={journalCollectionKey(discovery.appliedFilters.origins)}
        label={t("origins")}
        scroll={false}
        tabs={(
          [
            ["allStories", "all"],
            ["communityJournal", "community"],
            ["fromIndex", "index"],
          ] as const
        ).map(([id, origin]) => ({
          id,
          label: t(id),
          count:
            origin === "all"
              ? origins.reduce((sum, facet) => sum + facet.count, 0)
              : origins.find((facet) => facet.value === origin)?.count,
          href: journalHref(query, {
            filters: {
              ...query.filters,
              origins: origin === "all" ? [] : [origin],
            },
            allOrigins: origin === "all",
          }),
        }))}
      />
      <div className="relative flex min-w-0 items-center gap-x-3 overflow-x-auto border-t border-(--t-divider) py-[6px] [scrollbar-width:none] after:pointer-events-none after:sticky after:right-0 after:-ml-6 after:w-6 after:shrink-0 after:self-stretch after:bg-linear-to-l after:from-(--t-bg-deep) after:to-transparent lg:shrink-0 lg:border-t-0 lg:after:hidden [&>div]:shrink-0 [&>div:first-child]:border-0 [&>div:first-child]:py-0">
        <ArticleDiscoveryFilters
          compact
          kind="journal"
          discovery={{
            ...discovery,
            facets: {
              ...discovery.facets,
              sections: discovery.facets.sections.map((facet) => ({
                ...facet,
                label:
                  sections.find(
                    (section) =>
                      section.slug === facet.value ||
                      section.slug === facet.slug
                  )?.name ?? facet.label,
              })),
            },
          }}
        />
        <JournalListControls query={query} />
      </div>
    </SectionNavigation>
  )
}
