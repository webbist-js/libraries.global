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
}: {
  readonly articles: BlogArticleSummary[]
  readonly featuredArticle: BlogArticleSummary | null
}) {
  const [activeSection, setActiveSection] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("newest")

  // Derive sections with counts
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = { All: articles.length }
    for (const a of articles) {
      if (a.section?.name) {
        counts[a.section.name] = (counts[a.section.name] || 0) + 1
      }
    }

    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [articles])

  // Process articles (Filter + Sort)
  const processedArticles = useMemo(() => {
    let result = [...articles]

    // Section Filter
    if (activeSection !== "All") {
      result = result.filter((a) => a.section?.name === activeSection)
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.summary?.toLowerCase().includes(q) ||
          a.author?.toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === "newest") {
        const dateA = new Date(a.publishedAt || a.updatedAt || 0).getTime()
        const dateB = new Date(b.publishedAt || b.updatedAt || 0).getTime()

        return dateB - dateA
      }

      if (sortOrder === "oldest") {
        const dateA = new Date(a.publishedAt || a.updatedAt || 0).getTime()
        const dateB = new Date(b.publishedAt || b.updatedAt || 0).getTime()

        return dateA - dateB
      }

      if (sortOrder === "title") {
        return (a.title ?? "").localeCompare(b.title ?? "")
      }

      return 0
    })

    return result
  }, [articles, activeSection, searchQuery, sortOrder])

  return (
    <>
      <BlogFilterBar
        categories={categoryStats}
        activeCategory={activeSection}
        onCategoryChange={setActiveSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />

      {/* ── Featured article ───────────────────────────────────────────── */}
      {featuredArticle && activeSection === "All" && !searchQuery ? (
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
