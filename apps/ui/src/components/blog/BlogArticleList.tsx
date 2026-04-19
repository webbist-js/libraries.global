"use client"

import { useState } from "react"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

import { BlogArticleCard } from "./BlogArticleCard"

function SidebarArticleRow({
  article,
  index,
}: {
  readonly article: BlogArticleSummary
  readonly index: number
}) {
  if (!article.slug) return null

  return (
    <GlobalLink
      href={`/blog/${article.slug}`}
      className="group flex items-start gap-3 border-b border-white/[0.05] py-4 last:border-0"
    >
      <span className="mt-0.5 flex-none font-mono text-[10px] text-white/20 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        {article.category ? (
          <p className="mb-1 font-mono text-[9px] tracking-[0.18em] text-white/25 uppercase">
            {article.category}
          </p>
        ) : null}
        <h4 className="line-clamp-2 text-[13px] leading-snug font-medium text-white/55 transition-colors group-hover:text-white">
          {article.title}
        </h4>
        <p className="mt-1.5 font-mono text-[10px] text-white/22">
          {formatDate(article.publishedAt ?? article.updatedAt, "short")}
        </p>
      </div>
    </GlobalLink>
  )
}

export default function BlogArticleList({
  articles,
}: {
  readonly articles: BlogArticleSummary[]
}) {
  // Derive category list
  const seen = new Set<string>()
  const categories: string[] = ["All"]
  for (const a of articles) {
    if (a.category && !seen.has(a.category)) {
      seen.add(a.category)
      categories.push(a.category)
    }
  }

  const [activeCategory, setActiveCategory] = useState("All")

  const filtered = articles.filter(
    (a) => activeCategory === "All" || a.category === activeCategory
  )

  const sidebarArticles = articles.slice(0, 6)

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
      {/* Main articles area */}
      <div>
        {/* Category filter tabs */}
        {categories.length > 1 ? (
          <div className="mb-8 flex flex-wrap items-center gap-1.5 border-b border-white/6 pb-5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-all duration-200",
                  activeCategory === cat
                    ? "bg-white text-[#050816]"
                    : "text-white/40 hover:text-white/65"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState message="No articles in this category." />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {filtered.map((article, i) => (
              <BlogArticleCard
                key={article.documentId}
                article={article}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-7">
          {/* Latest articles compact list */}
          <div>
            <p className="mb-4 font-mono text-[10px] tracking-[0.22em] text-white/28 uppercase">
              This week&apos;s dispatch
            </p>
            <div>
              {sidebarArticles.map((a, i) => (
                <SidebarArticleRow key={a.documentId} article={a} index={i} />
              ))}
            </div>
          </div>

          {/* Subscribe CTA */}
          <div className="rounded-xl border border-white/[0.07] bg-[#060b19] p-5">
            <p className="mb-2 font-[family-name:var(--font-fraunces)] text-[1.1rem] leading-tight font-semibold text-white">
              Join the journal
            </p>
            <p className="mb-4 text-[12px] leading-6 text-white/38">
              New dispatches, curated picks, and notes from the stacks delivered
              monthly.
            </p>
            <GlobalLink
              href="/subscribe"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 font-mono text-[11px] tracking-[0.1em] text-white/55 uppercase transition-all hover:bg-white/[0.09] hover:text-white"
            >
              Subscribe →
            </GlobalLink>
          </div>
        </div>
      </aside>
    </div>
  )
}
