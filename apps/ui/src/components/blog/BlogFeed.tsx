"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

import { Container } from "@/components/elementary/Container"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

import BlogArticleList from "./BlogArticleList"
import { buildFeedLayout } from "./blogFeed.helpers"
import { BlogFilterBar } from "./BlogFilterBar"
import { FeaturedArticleCard } from "./FeaturedArticleCard"
import { MoreToCome } from "./MoreToCome"

type BlogFeedProps = {
  readonly articles: BlogArticleSummary[]
  readonly featuredArticle: BlogArticleSummary | null
  readonly sections?: { documentId: string; name: string; slug: string }[]
}

/** The page is force-static, so ?section= is read client-side on hydration. */
export default function BlogFeed(props: BlogFeedProps) {
  return (
    <Suspense fallback={null}>
      <BlogFeedInner {...props} />
    </Suspense>
  )
}

function BlogFeedInner({
  articles,
  featuredArticle,
  sections = [],
}: BlogFeedProps) {
  const searchParams = useSearchParams()
  const initialSectionSlug = searchParams.get("section")
  const [activeSection, setActiveSection] = useState(
    () => sections.find((s) => s.slug === initialSectionSlug)?.name ?? "All"
  )
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

  const featured = activeSection === "All" ? featuredArticle : null

  // The featured card is not repeated in the list, and a young journal
  // follows its articles with an invitation rather than replacing them.
  const { listed, showList, showMoreToCome } = buildFeedLayout({
    processedArticles,
    featured,
    activeSection,
    totalArticles: articles.length,
  })

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
      {featured ? (
        <section className="pt-5 pb-4">
          <Container>
            <FeaturedArticleCard article={featured} />
          </Container>
        </section>
      ) : null}

      {showList ? (
        <section
          className={
            featured ? "py-14 sm:py-20" : "pt-8 pb-14 sm:pt-10 sm:pb-20"
          }
        >
          <Container>
            <div className="mb-10">
              <h2
                className="m-0 text-[clamp(30px,3.4vw,44px)] leading-[1.05]"
                style={{
                  fontFamily: "var(--font-newsreader), Georgia, serif",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--t-ink-base)",
                }}
              >
                Latest{" "}
                <em
                  style={{ fontWeight: 400, color: "var(--t-accent-primary)" }}
                >
                  dispatches
                </em>
              </h2>
            </div>
            <BlogArticleList articles={listed} />
          </Container>
        </section>
      ) : null}

      {showMoreToCome ? <MoreToCome articleCount={articles.length} /> : null}
    </>
  )
}
