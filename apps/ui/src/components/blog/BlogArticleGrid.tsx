import { useTranslations as useUiTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/EmptyState"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

import { BlogArticleCard } from "./BlogArticleCard"

// ── Pagination ─────────────────────────────────────────────────────────────────

const PAGER_LINK_CLASS =
  "rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted)"

function Pagination({
  page,
  pageCount,
  baseUrl,
}: {
  page: number
  pageCount: number
  baseUrl: string
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  if (pageCount <= 1) return null

  const prev = page > 1 ? `${baseUrl}?page=${page - 1}` : null
  const next = page < pageCount ? `${baseUrl}?page=${page + 1}` : null

  return (
    <nav
      aria-label={tUi("pagination")}
      className="mt-12 flex items-center justify-center gap-4 border-t pt-10"
      style={{ borderColor: T.border.line }}
    >
      {prev ? (
        <GlobalLink
          href={prev}
          className={PAGER_LINK_CLASS}
          style={{
            borderColor: T.border.hi,
            background: T.bg.deep,
            color: T.ink.base,
          }}
        >
          ← {tUi("previous")}
        </GlobalLink>
      ) : null}

      <span className="text-[14px]" style={{ color: T.ink.dim }}>
        {t("pageOf", { page, total: pageCount })}
      </span>

      {next ? (
        <GlobalLink
          href={next}
          className={PAGER_LINK_CLASS}
          style={{
            borderColor: T.border.hi,
            background: T.bg.deep,
            color: T.ink.base,
          }}
        >
          {tUi("next")} →
        </GlobalLink>
      ) : null}
    </nav>
  )
}

// ── Grid ───────────────────────────────────────────────────────────────────────

export function BlogArticleGrid({
  articles,
  page,
  pageCount,
  baseUrl,
}: {
  readonly articles: BlogArticleSummary[]
  readonly page: number
  readonly pageCount: number
  readonly baseUrl: string
}) {
  const t = useUiTranslations("editorial")
  if (articles.length === 0) {
    return (
      <EmptyState
        surface
        icon="mdi:newspaper-variant-outline"
        lead={t("emptySection")}
        detail={t("newDispatches")}
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <BlogArticleCard key={article.documentId} article={article} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} baseUrl={baseUrl} />
    </>
  )
}

export default BlogArticleGrid
