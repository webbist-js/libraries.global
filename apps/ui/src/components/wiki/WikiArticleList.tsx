"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import type {
  WikiArticleSummary,
  WikiCategorySummary,
} from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

// ── Article row ────────────────────────────────────────────────────────────────

function ArticleRow({
  article,
  index,
}: {
  article: WikiArticleSummary
  index: number
}) {
  if (!article.slug) return null

  return (
    <GlobalLink
      href={`/wiki/${article.slug}`}
      className="group flex items-start gap-5 py-5 transition-opacity duration-200 hover:opacity-80"
    >
      <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-bold text-white/20 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 space-y-1">
        <h4 className="text-sm leading-snug font-semibold text-white transition-colors group-hover:text-cyan-50">
          {article.title}
        </h4>
        {article.summary ? (
          <p className="line-clamp-2 text-xs leading-5 text-white/45">
            {article.summary}
          </p>
        ) : null}
        <div className="flex items-center gap-3 pt-0.5">
          {article.updatedAt ? (
            <span className="text-[10px] text-white/28">
              Updated: {formatDate(article.updatedAt, "short")}
            </span>
          ) : null}
          {article.author ? (
            <>
              <span className="text-white/16">·</span>
              <span className="text-[10px] text-white/28">
                {article.author}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </GlobalLink>
  )
}

// ── Inner list (requires searchParams) ────────────────────────────────────────

function WikiArticleListInner({
  articles,
  categories,
}: {
  articles: WikiArticleSummary[]
  categories: WikiCategorySummary[]
}) {
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get("category") ?? "All"

  const filtered = articles.filter(
    (a) => activeCategory === "All" || a.category?.slug === activeCategory
  )

  return (
    <div>
      {/* Category filter tabs */}
      {categories.length > 0 ? (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <GlobalLink
            href="/wiki"
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
              activeCategory === "All"
                ? "border-cyan-400/40 bg-cyan-500/16 text-cyan-200"
                : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:bg-white/8 hover:text-white/75"
            )}
          >
            All
          </GlobalLink>
          {categories.map((cat) => (
            <GlobalLink
              key={cat.documentId}
              href={`/wiki?category=${cat.slug}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
                activeCategory === cat.slug
                  ? "border-cyan-400/40 bg-cyan-500/16 text-cyan-200"
                  : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:bg-white/8 hover:text-white/75"
              )}
            >
              {cat.name}
            </GlobalLink>
          ))}
        </div>
      ) : null}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-white/30">
            No articles in this category yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
          {filtered.map((article, i) => (
            <div
              key={article.documentId}
              className="border-b border-white/6 last:border-0 lg:[&:nth-last-child(-n+2)]:border-0"
            >
              <ArticleRow article={article} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Public component (wraps in Suspense for useSearchParams) ──────────────────

export default function WikiArticleList({
  articles,
  categories,
}: {
  readonly articles: WikiArticleSummary[]
  readonly categories: WikiCategorySummary[]
}) {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 py-8 lg:grid-cols-2 lg:gap-x-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-white/6 py-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/6" />
            </div>
          ))}
        </div>
      }
    >
      <WikiArticleListInner articles={articles} categories={categories} />
    </Suspense>
  )
}
