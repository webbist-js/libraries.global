import type { ArticleBrowseResult } from "@repo/shared-data"
import { useTranslations, type Locale } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { Link, routing } from "@/lib/navigation"

import { KnowledgeBrowsePagination } from "./KnowledgeBrowsePagination"

export function KnowledgeDiscovery({
  discovery,
  locale,
}: {
  readonly discovery: ArticleBrowseResult
  readonly locale: Locale
}) {
  const t = useTranslations("discovery")
  const p = useTranslations("publishing")

  return (
    <section aria-labelledby="knowledge-discovery" className="mb-10">
      <h2
        className="mb-2 text-3xl"
        id="knowledge-discovery"
        style={{ fontFamily: T.font.serif }}
      >
        {t("exploreKnowledge")}
      </h2>
      <p className="text-sm" style={{ color: T.ink.dim }}>
        {t("knowledgeLead")}
      </p>
      <ArticleDiscoveryFilters discovery={discovery} kind="knowledge" />
      <p aria-live="polite" className="mt-4 text-sm">
        {t("articleCount", { count: discovery.total })}
      </p>
      <ul className="grid list-none gap-3 p-0 md:grid-cols-2">
        {discovery.items.map((article) => {
          const supported = (routing.locales as readonly string[]).includes(
            article.locale
          )
          const path = `/knowledge/${article.section?.slug ?? article.sectionSlugs[0] ?? "general"}/${article.slug}`

          return (
            <li
              className="rounded-xl border p-4"
              key={`${article.documentId}:${article.locale}`}
              style={{ borderColor: T.border.line, background: T.bg.deep }}
            >
              <Link
                className="text-lg font-semibold underline"
                href={`${path}${supported ? "" : `?contentLang=${encodeURIComponent(article.locale)}`}`}
                locale={supported ? (article.locale as Locale) : locale}
              >
                {article.title}
              </Link>
              {article.summary ? (
                <p className="mb-2 line-clamp-2 text-sm">{article.summary}</p>
              ) : null}
              <p className="mb-0 text-sm" style={{ color: T.ink.dim }}>
                {languageName(article.locale, [], locale)} ·{" "}
                {t("readingTime", { minutes: article.readingTimeMinutes })}
                {article.place ? ` · ${article.place}` : ""}
              </p>
            </li>
          )
        })}
      </ul>
      {!discovery.items.length && (
        <p>
          {p("noResults")}{" "}
          <Link href="/knowledge?lang=all&country=all" className="underline">
            {p("resetSearch")}
          </Link>
        </p>
      )}
      <KnowledgeBrowsePagination
        page={discovery.page}
        pageCount={discovery.pageCount}
      />
    </section>
  )
}
