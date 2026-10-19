import { Icon } from "@iconify/react"
import type { ArticleBrowseResult } from "@repo/shared-data"
import { useTranslations, type Locale } from "next-intl"

import type { DocsSection } from "@/components/docs/docs.config"
import { EmptyState } from "@/components/ds/EmptyState"
import { languageName } from "@/lib/locale-fallback"
import { Link, routing } from "@/lib/navigation"

import { KnowledgeBrowsePagination } from "./KnowledgeBrowsePagination"

/** The focused section/search list shares the same reader links and pagination. */
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
  const e = useTranslations("editorial")
  const p = useTranslations("publishing")

  return (
    <section
      aria-labelledby="knowledge-discovery"
      className="scroll-mt-40 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-2 sm:px-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--t-divider) py-5">
        <h2
          id="knowledge-discovery"
          aria-live="polite"
          className="m-0 text-sm font-semibold"
        >
          {e("guideCount", { count: discovery.total })}
        </h2>
        <p className="m-0 text-xs text-(--t-ink-dim)">
          {section ? section.title : t("exploreKnowledge")}
        </p>
      </div>
      <ol className="m-0 list-none p-0">
        {discovery.items.map((article, index) => {
          const supported = (routing.locales as readonly string[]).includes(
            article.locale
          )
          const path = `/knowledge/${article.section?.slug ?? article.sectionSlugs[0] ?? "general"}/${article.slug}`

          return (
            <li
              className="border-b border-(--t-divider) last:border-0"
              key={`${article.documentId}:${article.locale}`}
            >
              <Link
                className="group grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-1 py-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:gap-x-4"
                href={`${path}${supported ? "" : `?contentLang=${encodeURIComponent(article.locale)}`}`}
                locale={supported ? (article.locale as Locale) : locale}
              >
                <span
                  aria-hidden="true"
                  className="pt-1 text-xs font-medium text-(--t-ink-dim) tabular-nums"
                >
                  {String(
                    (discovery.page - 1) * discovery.pageSize + index + 1
                  ).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-[25px] leading-tight font-medium text-pretty transition-colors group-hover:text-(--t-accent-primary)">
                    {article.title}
                  </span>
                  {article.summary ? (
                    <span className="mt-2 block max-w-[70ch] text-sm leading-relaxed text-(--t-ink-dim)">
                      {article.summary}
                    </span>
                  ) : null}
                  {article.locale !== locale || !section ? (
                    <span className="mt-3 inline-flex rounded-full bg-(--t-bg-muted) px-2.5 py-1 text-xs font-medium text-(--t-ink-dim)">
                      {languageName(article.locale, [], locale)}
                      {!section && article.section?.name
                        ? ` · ${article.section.name}`
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span className="col-start-2 mt-2 text-xs whitespace-nowrap text-(--t-ink-dim) sm:col-start-3 sm:mt-1">
                  {t("readingTime", { minutes: article.readingTimeMinutes })}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      {!discovery.items.length ? (
        <EmptyState
          icon="mdi:book-open-page-variant-outline"
          lead={p("noResults")}
          action={
            <Link
              href={
                section
                  ? `/knowledge?section=${section.slug}&lang=all&country=all`
                  : "/knowledge?lang=all&country=all"
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--t-border-hi) px-5 py-2.5 text-sm font-semibold text-(--t-accent-primary)"
            >
              {p("resetSearch")}
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
            </Link>
          }
        />
      ) : null}
      <KnowledgeBrowsePagination
        page={discovery.page}
        pageCount={discovery.pageCount}
      />
    </section>
  )
}
