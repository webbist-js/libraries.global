import { Icon } from "@iconify/react"
import type { ArticleBrowseResult } from "@repo/shared-data"
import { useTranslations, type Locale } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import type { DocsSection } from "@/components/docs/docs.config"
import { EmptyState } from "@/components/ds/EmptyState"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { Link, routing } from "@/lib/navigation"

import { KnowledgeBrowsePagination } from "./KnowledgeBrowsePagination"

export function KnowledgeDiscovery({
  discovery,
  locale,
  section,
}: {
  readonly discovery: ArticleBrowseResult
  readonly section?: DocsSection
  readonly locale: Locale
}) {
  const t = useTranslations("discovery")
  const p = useTranslations("publishing")

  return (
    <section
      aria-labelledby="knowledge-discovery"
      className="mb-10 scroll-mt-24"
    >
      <h2
        className="m-0 text-[32px] sm:text-[38px]"
        id="knowledge-discovery"
        style={{ fontFamily: T.font.serif }}
      >
        {section?.title ?? t("exploreKnowledge")}
      </h2>
      <p
        className="mt-2 mb-0 max-w-2xl text-[15px] leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        {section?.description ?? t("knowledgeLead")}
      </p>
      <ArticleDiscoveryFilters discovery={discovery} kind="knowledge" />
      <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className="m-0 text-sm font-semibold text-(--t-ink-dim)"
        >
          {t("articleCount", { count: discovery.total })}
        </p>
        <p className="m-0 text-xs text-(--t-ink-dim)">{t("languageDefault")}</p>
      </div>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {discovery.items.map((article) => {
          const supported = (routing.locales as readonly string[]).includes(
            article.locale
          )
          const path = `/knowledge/${article.section?.slug ?? article.sectionSlugs[0] ?? "general"}/${article.slug}`

          return (
            <li
              className="min-w-0"
              key={`${article.documentId}:${article.locale}`}
            >
              <Link
                className="group flex h-full flex-col rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 transition-colors hover:border-(--t-accent-primary) hover:bg-(--t-bg-muted) sm:p-6"
                href={`${path}${supported ? "" : `?contentLang=${encodeURIComponent(article.locale)}`}`}
                locale={supported ? (article.locale as Locale) : locale}
              >
                <span className="mb-4 flex items-center gap-2 text-xs font-semibold text-(--t-ink-dim)">
                  <Icon
                    aria-hidden="true"
                    icon={
                      article.section?.icon ??
                      section?.icon ??
                      "mdi:book-open-outline"
                    }
                    width={17}
                    className="text-(--t-accent-primary)"
                  />
                  {discovery.facets.sections.find((facet) =>
                    article.sectionSlugs.includes(facet.value)
                  )?.label ??
                    section?.title ??
                    t("exploreKnowledge")}
                </span>
                <h3
                  className="m-0 text-[24px] leading-tight text-pretty group-hover:text-(--t-accent-primary)"
                  style={{ fontFamily: T.font.serif }}
                >
                  {article.title}
                </h3>
                {article.summary ? (
                  <p className="mt-3 mb-5 line-clamp-3 text-[15px] leading-relaxed text-(--t-ink-dim)">
                    {article.summary}
                  </p>
                ) : null}
                <p
                  className="mt-auto mb-0 flex flex-wrap items-center justify-between gap-3 border-t border-(--t-border-line) pt-4 text-xs"
                  style={{ color: T.ink.dim }}
                >
                  <span>
                    {languageName(article.locale, [], locale)} ·{" "}
                    {t("readingTime", { minutes: article.readingTimeMinutes })}
                    {article.place ? ` · ${article.place}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-(--t-accent-primary)">
                    {t("readGuide")}{" "}
                    <Icon
                      aria-hidden="true"
                      icon="mdi:arrow-right"
                      width={16}
                    />
                  </span>
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
      {!discovery.items.length && (
        <EmptyState
          icon="mdi:book-open-page-variant-outline"
          lead={p("noResults")}
          action={
            <Link
              href="/knowledge?lang=all&country=all"
              className="min-h-11 rounded-full border border-(--t-border-hi) px-5 py-2.5 font-semibold text-(--t-accent-primary)"
            >
              {p("resetSearch")}
            </Link>
          }
        />
      )}
      <KnowledgeBrowsePagination
        page={discovery.page}
        pageCount={discovery.pageCount}
      />
    </section>
  )
}
