"use client"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

import { BlogArticleCard } from "./BlogArticleCard"

function SidebarArticleRow({
  article,
}: {
  readonly article: BlogArticleSummary
}) {
  if (!article.slug) return null

  return (
    <GlobalLink
      href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
      className="group block border-b py-4 last:border-0"
      style={{ borderColor: T.border.divider }}
    >
      {(article.section?.name ?? article.category?.name) ? (
        <p
          className="m-0 mb-1 text-[13px] font-semibold"
          style={{ color: T.accent.ember }}
        >
          {article.section?.name ?? article.category?.name}
        </p>
      ) : null}
      <h4
        className="m-0 line-clamp-2 text-[17px] leading-snug transition-colors group-hover:text-(--t-accent-primary)"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          color: T.ink.base,
        }}
      >
        {article.title}
      </h4>
      <p className="m-0 mt-1 text-[13px]" style={{ color: T.ink.dim }}>
        {formatDate(article.publishedAt ?? article.updatedAt, "short")}
      </p>
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
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      {/* Main articles area */}
      <div>
        {articles.length === 0 ? (
          <EmptyState message="No articles found." />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {articles.map((article) => (
              <BlogArticleCard key={article.documentId} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-6">
          {/* Latest articles compact list */}
          <div
            className="rounded-[20px] border px-5 py-4"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <p
              className="m-0 mb-1 text-[14px] font-semibold"
              style={{ color: T.ink.base }}
            >
              This week&rsquo;s dispatch
            </p>
            <div>
              {sidebarArticles.map((a) => (
                <SidebarArticleRow key={a.documentId} article={a} />
              ))}
            </div>
          </div>

          {/* Subscribe CTA */}
          <div
            className="rounded-[20px] border p-5"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <p
              className="m-0 mb-2 text-[22px] leading-tight"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              Join the journal
            </p>
            <p
              className="m-0 mb-4 text-[15px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              New dispatches, curated picks, and notes from the stacks delivered
              monthly.
            </p>
            <GlobalLink
              href="/subscribe"
              className="inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
              style={{ background: T.accent.primary }}
            >
              Subscribe
            </GlobalLink>
          </div>
        </div>
      </aside>
    </div>
  )
}
