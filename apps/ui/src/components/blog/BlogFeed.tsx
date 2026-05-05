"use client"

import { useMemo, useState } from "react"

import { Container } from "@/components/elementary/Container"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

import BlogArticleList from "./BlogArticleList"
import { BlogFilterBar } from "./BlogFilterBar"
import { FeaturedArticleCard } from "./FeaturedArticleCard"

export default function BlogFeed({
  articles,
  featuredArticle,
  sections = [],
}: {
  readonly articles: BlogArticleSummary[]
  readonly featuredArticle: BlogArticleSummary | null
  readonly sections?: { documentId: string; name: string; slug: string }[]
}) {
  const [activeSection, setActiveSection] = useState("All")
  const [sortOrder, setSortOrder] = useState("newest")

  // Build section tab list: All + sections from API with article counts.
  // Falls back to article.category when article.section is absent (older data).
  const categoryStats = useMemo(() => {
    const groupOf = (a: (typeof articles)[number]) =>
      a.section?.name ?? a.category?.name ?? null

    const counts: Record<string, number> = { All: articles.length }
    for (const a of articles) {
      const g = groupOf(a)
      if (g) counts[g] = (counts[g] ?? 0) + 1
    }

    // Use API sections order; fall back to derived groups if none provided
    if (sections.length > 0) {
      return [
        { name: "All", count: articles.length },
        ...sections.map((s) => ({ name: s.name, count: counts[s.name] ?? 0 })),
      ]
    }

    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [articles, sections])

  // Process articles (Filter + Sort)
  const processedArticles = useMemo(() => {
    let result = [...articles]

    // Section filter — match section name first, fall back to category name
    if (activeSection !== "All") {
      result = result.filter(
        (a) => (a.section?.name ?? a.category?.name) === activeSection
      )
    }

    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.publishedAt || b.updatedAt || 0).getTime() -
          new Date(a.publishedAt || a.updatedAt || 0).getTime()
        )
      }
      if (sortOrder === "oldest") {
        return (
          new Date(a.publishedAt || a.updatedAt || 0).getTime() -
          new Date(b.publishedAt || b.updatedAt || 0).getTime()
        )
      }
      if (sortOrder === "title") {
        return (a.title ?? "").localeCompare(b.title ?? "")
      }

      return 0
    })

    return result
  }, [articles, activeSection, sortOrder])

  return (
    <>
      <BlogFilterBar
        categories={categoryStats}
        activeCategory={activeSection}
        onCategoryChange={setActiveSection}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />

      {/* ── Featured article ───────────────────────────────────────────── */}
      {featuredArticle && activeSection === "All" ? (
        <section className="border-b border-(--t-border-line) py-12 sm:py-16">
          <Container>
            <p className="mb-6 font-mono text-[10px] tracking-[0.22em] text-(--t-ink-faint) uppercase">
              — Featured this issue
            </p>
            <FeaturedArticleCard article={featuredArticle} />
          </Container>
        </section>
      ) : null}

      <section className="py-14 sm:py-20">
        <Container>
          <div className="mb-10">
            <h2 className="font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.02em] text-(--t-ink-base) sm:text-[3rem]">
              Latest <em className="text-(--t-ink-dim) italic">dispatches</em>
            </h2>
          </div>
          <BlogArticleList articles={processedArticles} />
        </Container>
      </section>
    </>
  )
}
