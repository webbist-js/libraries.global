"use client"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

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
        {(article.section?.name ?? article.category?.name) ? (
          <p className="mb-1 font-mono text-[9px] tracking-[0.18em] text-white/25 uppercase">
            {article.section?.name ?? article.category?.name}
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
  const sidebarArticles = articles.slice(0, 6)

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
      {/* Main articles area */}
      <div>
        {articles.length === 0 ? (
          <EmptyState message="No articles found." />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {articles.map((article, i) => (
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
          <div
            className="rounded-xl p-5"
            style={{
              background: T.bg.surface,
              border: `1px solid ${T.border.line}`,
            }}
          >
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
