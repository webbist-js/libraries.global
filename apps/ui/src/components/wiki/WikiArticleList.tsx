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
      <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-bold text-(--t-ink-faint) tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 space-y-1">
        <h4 className="text-sm leading-snug font-semibold text-(--t-ink-base) transition-colors group-hover:text-(--t-accent-aurora)">
          {article.title}
        </h4>
        {article.summary ? (
          <p className="line-clamp-2 text-xs leading-5 text-(--t-ink-low)">
            {article.summary}
          </p>
        ) : null}
        <div className="flex items-center gap-3 pt-0.5">
          {article.updatedAt ? (
            <span className="text-[10px] text-(--t-ink-faint)">
              Updated: {formatDate(article.updatedAt, "short")}
            </span>
          ) : null}
          {article.author ? (
            <>
              <span className="text-(--t-border-hi)">·</span>
              <span className="text-[10px] text-(--t-ink-faint)">
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
                ? "border-(--t-aurora-edge) bg-(--t-aurora-soft) text-(--t-accent-aurora)"
                : "border-(--t-border-line) bg-(--t-bg-surface) text-(--t-ink-low) hover:border-(--t-border-hi) hover:bg-(--t-bg-deep) hover:text-(--t-ink-dim)"
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
                  ? "border-(--t-aurora-edge) bg-(--t-aurora-soft) text-(--t-accent-aurora)"
                  : "border-(--t-border-line) bg-(--t-bg-surface) text-(--t-ink-low) hover:border-(--t-border-hi) hover:bg-(--t-bg-deep) hover:text-(--t-ink-dim)"
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
          <p className="text-sm text-(--t-ink-faint)">
            No articles in this category yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
          {filtered.map((article, i) => (
            <div
              key={article.documentId}
              className="border-b border-(--t-border-line) last:border-0 lg:[&:nth-last-child(-n+2)]:border-0"
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
            <div key={i} className="border-b border-(--t-border-line) py-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-(--t-bg-surface)" />
            </div>
          ))}
        </div>
      }
    >
      <WikiArticleListInner articles={articles} categories={categories} />
    </Suspense>
  )
}
