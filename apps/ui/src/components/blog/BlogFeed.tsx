"use client"

import { useEffect, useMemo, useState } from "react"

import { Container } from "@/components/elementary/Container"
import { searchBlogArticles } from "@/lib/meilisearch"
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
  // null = not searching, string[] = ordered slug matches from MeiliSearch
  const [searchSlugs, setSearchSlugs] = useState<string[] | null>(null)

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

  // Debounced MeiliSearch for text query
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchSlugs(null)

        return
      }
      try {
        const res = await searchBlogArticles(searchQuery)
        setSearchSlugs(res.hits.map((h) => h.slug))
      } catch {
        setSearchSlugs(null)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [searchQuery])

  // Process articles (Filter + Sort)
  const processedArticles = useMemo(() => {
    let result = [...articles]

    // MeiliSearch text filter — reorder by relevance when active
    if (searchSlugs !== null) {
      const slugSet = new Set(searchSlugs)
      result = searchSlugs
        .map((slug) => result.find((a) => a.slug === slug))
        .filter(Boolean) as BlogArticleSummary[]
      // include any matched that MeiliSearch returned but aren't in local list
      result = result.filter((a) => slugSet.has(a.slug ?? ""))
    }

    // Section filter
    if (activeSection !== "All") {
      result = result.filter((a) => a.section?.name === activeSection)
    }

    // Sorting (skip when search active — MeiliSearch rank is more useful)
    if (!searchQuery.trim()) {
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
    }

    return result
  }, [articles, activeSection, searchQuery, searchSlugs, sortOrder])

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
