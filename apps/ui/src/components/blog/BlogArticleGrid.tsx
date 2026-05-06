import GlobalLink from "@/components/global/GlobalLink"
import { BlogCard } from "@/components/home/sections/BlogSection"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

// ── Pagination ─────────────────────────────────────────────────────────────────

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        paddingTop: "48px",
        marginTop: "48px",
        borderTop: `1px solid ${T.border.line}`,
      }}
    >
      {prev ? (
        <GlobalLink
          href={prev}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.dim,
            textDecoration: "none",
            padding: "8px 16px",
            border: `1px solid ${T.border.line}`,
            borderRadius: "10px",
            transition: "border-color 150ms, color 150ms",
          }}
          className="hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
        >
          ← Prev
        </GlobalLink>
      ) : null}

      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          color: T.ink.faint,
          textTransform: "uppercase",
        }}
      >
        {page} / {pageCount}
      </span>

      {next ? (
        <GlobalLink
          href={next}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.dim,
            textDecoration: "none",
            padding: "8px 16px",
            border: `1px solid ${T.border.line}`,
            borderRadius: "10px",
            transition: "border-color 150ms, color 150ms",
          }}
          className="hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
        >
          Next →
        </GlobalLink>
      ) : null}
    </div>
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
        style={{
          padding: "80px",
          textAlign: "center",
          color: T.ink.low,
          fontSize: "15px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "18px",
          background: T.bg.surface,
        }}
      >
        No articles in this section yet.
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        {articles.map((article) => (
          <BlogCard key={article.documentId} article={article} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} baseUrl={baseUrl} />
    </>
  )
}

export default BlogArticleGrid
