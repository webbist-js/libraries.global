"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { docsPathForSearchHit } from "@/components/docs/docs.config"
import { Breadcrumb } from "@/components/ds/Breadcrumb"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  searchWikiArticles,
  type WikiArticleSearchHit,
} from "@/lib/meilisearch"

function SearchResult({ hit }: { hit: WikiArticleSearchHit }) {
  return (
    <GlobalLink
      href={docsPathForSearchHit(hit)}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        {hit.section_name && (
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: T.ink.dim,
              margin: 0,
            }}
          >
            {hit.section_name}
          </p>
        )}
        {hit.category_slug && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: T.accent.primaryHover,
              padding: "2px 10px",
              background: T.accent.chip,
              borderRadius: "999px",
            }}
          >
            {hit.category_slug}
          </span>
        )}
      </div>
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
      {hit.summary && (
        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            lineHeight: 1.6,
            color: T.ink.dim,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {hit.summary}
        </p>
      )}
    </GlobalLink>
  )
}

function DocsSearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<WikiArticleSearchHit[]>([])
  const [resolvedQuery, setResolvedQuery] = useState("")
  const pendingRef = useRef(0)

  useEffect(() => {
    if (!query.trim()) return

    const id = ++pendingRef.current

    searchWikiArticles(query, null, 40)
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
        <p style={{ color: T.ink.dim, fontSize: "14px" }}>Searching…</p>
      ) : searched && results.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            border: `1px solid ${T.border.line}`,
            borderRadius: "18px",
            background: T.bg.surface,
            color: T.ink.dim,
            fontSize: "15px",
          }}
        >
          No pages found for &ldquo;{query}&rdquo;.
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
      <section
        style={{
          padding: "48px 0 36px",
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <Container>
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Docs", href: "/docs" },
              { label: "Search" },
            ]}
          />
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 500,
              letterSpacing: "-.02em",
              lineHeight: 1.05,
              color: T.ink.base,
              marginTop: "16px",
              marginBottom: 0,
            }}
          >
            {query ? (
              <>
                Results for{" "}
                <em style={{ fontStyle: "italic", color: T.accent.primary }}>
                  &ldquo;{query}&rdquo;
                </em>
              </>
            ) : (
              "Search the docs"
            )}
          </h1>
        </Container>
      </section>

      <section style={{ padding: "48px 0 80px" }}>
        <Container>
          <DocsSearchResults query={query} />
          {!query.trim() && (
            <p style={{ color: T.ink.dim, fontSize: "15px" }}>
              Enter a search term to find documentation pages.
            </p>
          )}
        </Container>
      </section>
    </main>
  )
}

export function DocsSearchClient() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  )
}
