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
  if (pageCount <= 1) return null

  const prev = page > 1 ? `${baseUrl}?page=${page - 1}` : null
  const next = page < pageCount ? `${baseUrl}?page=${page + 1}` : null

  return (
    <nav
      aria-label="Pagination"
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
          ← Previous
        </GlobalLink>
      ) : null}

      <span className="text-[14px]" style={{ color: T.ink.dim }}>
        Page {page} of {pageCount}
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
          Next →
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
  if (articles.length === 0) {
    return (
      <div
        className="rounded-[24px] border px-8 py-16 text-center"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <p
          className="m-0 text-[24px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          No articles in this section yet
        </p>
        <p className="m-0 mt-2 text-[15px]" style={{ color: T.ink.dim }}>
          New dispatches land here as they&rsquo;re published.
        </p>
      </div>
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
