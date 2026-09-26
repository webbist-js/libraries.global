import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds/PageHero"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import type {
  BlogArticleSummary,
  BlogLandingData,
  BlogSection,
} from "@/lib/strapi-api/content/server"

import BlogFeed from "./BlogFeed"
import { BlogSearchBar } from "./BlogSearchBar"

export function BlogLandingPage({
  landing,
  articles,
  sections,
  locale,
}: {
  readonly landing: BlogLandingData | null
  readonly articles: BlogArticleSummary[]
  readonly sections: BlogSection[]
  readonly locale: Locale
}) {
  // The landing single-type and the articles list populate different fields
  // (landing has author/authorTitle, the list has section) — merge them.
  const featuredRef = landing?.featuredArticle ?? articles[0] ?? null
  const listCopy = featuredRef
    ? articles.find((a) => a.documentId === featuredRef.documentId)
    : null
  const featuredArticle = featuredRef
    ? {
        ...listCopy,
        ...featuredRef,
        section: featuredRef.section ?? listCopy?.section ?? null,
        heroImage: featuredRef.heroImage ?? listCopy?.heroImage ?? null,
      }
    : null

  const heroTitle = landing?.heroTitle ?? "Field notes *from the stacks.*"

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[{ label: "Home", href: "/" }, { label: "Journal" }]}
          eyebrow={landing?.heroEyebrow ?? "The Library Journal · since 2024"}
          eyebrowIcon="mdi:notebook-outline"
          lead={
            landing?.heroText ??
            "Histories, collection notes and dispatches, written by the librarians, archivists and researchers who document the index."
          }
          title={heroTitle}
        >
          <BlogSearchBar inputId="journal-search" />
        </PageHero>

        {/* ── Feed (filters + featured + list) ─────────────────────────── */}
        {articles.length > 0 && (
          <BlogFeed
            articles={articles}
            featuredArticle={featuredArticle}
            sections={sections}
          />
        )}
      </main>
    </div>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
