"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { PageHero, SearchField } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  searchBlogArticles,
  type BlogArticleSearchHit,
} from "@/lib/meilisearch"

function SearchResult({ hit }: { hit: BlogArticleSearchHit }) {
  return (
    <GlobalLink
      href={`/journal/${hit.section_slug ?? "general"}/${hit.slug}`}
      style={{
        display: "block",
        padding: "20px 24px",
        borderRadius: "12px",
        border: `1px solid ${T.border.line}`,
        background: T.bg.deep,
        textDecoration: "none",
        transition: "border-color 150ms",
      }}
      className="hover:border-(--t-border-hi)"
    >
      {hit.section_slug && (
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: T.accent.ember,
            marginBottom: "8px",
          }}
        >
          {hit.section_slug}
        </p>
      )}
      <h3
        style={{
          fontFamily: T.font.serif,
          fontSize: "1.2rem",
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: T.ink.base,
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {hit.title ?? hit.slug}
      </h3>
    </GlobalLink>
  )
}

function BlogSearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<BlogArticleSearchHit[]>([])
  // Track the last resolved query to derive loading/searched state without synchronous setState in effects
  const [resolvedQuery, setResolvedQuery] = useState("")
  const pendingRef = useRef(0)

  useEffect(() => {
    if (!query.trim()) return

    const id = ++pendingRef.current

    searchBlogArticles(query, 40)
      .then((res) => {
        if (id === pendingRef.current) {
          setResults(res.hits)
          setResolvedQuery(query)
        }
      })
      .catch(() => {
        if (id === pendingRef.current) {
          setResults([])
          setResolvedQuery(query)
        }
      })
  }, [query])

  if (!query.trim()) return null

  const loading = resolvedQuery !== query
  const searched = resolvedQuery === query

  return (
    <div style={{ marginTop: "32px" }}>
      {loading ? (
        <p
          style={{
            color: T.ink.faint,
            fontSize: "14px",
          }}
        >
          Searching…
        </p>
      ) : searched && results.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            border: `1px solid ${T.border.line}`,
            borderRadius: "18px",
            background: T.bg.surface,
            color: T.ink.low,
            fontSize: "15px",
          }}
        >
          No articles found for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <>
          <p
            style={{
              fontSize: "14px",
              color: T.ink.dim,
              marginBottom: "20px",
            }}
          >
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {results.map((hit) => (
              <SearchResult key={hit.documentId} hit={hit} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") ?? ""

  return (
    <main className="relative z-10 flex-1">
      <PageHero
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Journal", href: "/journal" },
          { label: "Search" },
        ]}
        compact
        eyebrow="The Library Journal"
        eyebrowIcon="mdi:notebook-outline"
        title={
          query
            ? `Results for *“${query.replaceAll("*", "")}”*`
            : "Search the *journal*"
        }
      >
        <form method="get">
          <SearchField
            id="journal-search"
            placeholder="Search articles, authors or topics"
            inputProps={{ name: "q", defaultValue: query, autoComplete: "off" }}
          />
        </form>
      </PageHero>

      <section style={{ padding: "48px 0 80px" }}>
        <Container>
          <BlogSearchResults query={query} />
          {!query.trim() && (
            <p style={{ color: T.ink.dim, fontSize: "15px" }}>
              Enter a search term in the search bar above to find articles.
            </p>
          )}
        </Container>
      </section>
    </main>
  )
}

export function BlogSearchClient() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  )
}
