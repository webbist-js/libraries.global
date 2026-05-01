"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo } from "react"

import { QuickPathCard } from "@/components/ds/WikiCards"
import { T } from "@/lib/design-tokens"
import type {
  WikiNavArticle,
  WikiSectionNav,
} from "@/lib/strapi-api/content/server"

import { WikiFilterBar } from "./WikiFilterBar"

function WikiSectionFeedInner({
  section,
  articles,
}: {
  readonly section: WikiSectionNav
  readonly articles: WikiNavArticle[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCategorySlug = searchParams.get("category") || "all"
  const searchQuery = searchParams.get("q") || ""

  const setCategory = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug === "all") params.delete("category")
    else params.set("category", slug)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const setSearchQuery = (q: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!q) params.delete("q")
    else params.set("q", q)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const categoryStats = useMemo(() => {
    const counts: Record<
      string,
      { name: string; count: number; slug: string }
    > = {
      all: { name: "All", slug: "all", count: articles.length },
    }
    for (const a of articles) {
      const catSlug = a.category?.slug
      const catName = a.category?.name
      if (catSlug && catName) {
        if (!counts[catSlug]) {
          counts[catSlug] = {
            name: catName,
            slug: catSlug,
            count: 0,
          }
        }
        counts[catSlug]!.count++
      }
    }

    return Object.values(counts)
  }, [articles])

  const processedArticles = useMemo(() => {
    let result = [...articles]

    if (activeCategorySlug !== "all") {
      result = result.filter((a) => a.category?.slug === activeCategorySlug)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.slug?.toLowerCase().includes(q)
      )
    }

    return result
  }, [articles, activeCategorySlug, searchQuery])

  return (
    <>
      <WikiFilterBar
        categories={categoryStats}
        activeCategorySlug={activeCategorySlug}
        onCategoryChange={setCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <section style={{ padding: "40px 0 80px" }}>
        <div
          style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 32px" }}
        >
          {processedArticles.length === 0 ? (
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
              No articles found matching your criteria.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "24px",
              }}
            >
              {processedArticles.map((article, i) => (
                <QuickPathCard
                  key={article.documentId}
                  card={{ ...article, section } as any}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export function WikiSectionFeed({
  section,
  articles,
}: {
  readonly section: WikiSectionNav
  readonly articles: WikiNavArticle[]
}) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-(--t-ink-low)">
          Loading articles...
        </div>
      }
    >
      <WikiSectionFeedInner section={section} articles={articles} />
    </Suspense>
  )
}
