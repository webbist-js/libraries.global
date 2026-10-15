"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { Suspense, useEffect, useRef, useState } from "react"

import {
  DOCS_VERSION,
  docsPathForSearchHit,
} from "@/components/docs/docs.config"
import { PageHero, SearchField } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import {
  analyticsAttributes,
  captureAnalyticsEvent,
  resultBucket,
} from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import {
  searchWikiArticles,
  type WikiArticleSearchHit,
} from "@/lib/meilisearch"

function SearchResult({ hit }: { hit: WikiArticleSearchHit }) {
  return (
    <GlobalLink
      href={docsPathForSearchHit(hit)}
      {...analyticsAttributes("select_content", {
        interaction_source: "article",
        content_type: "knowledge",
        content_id: hit.documentId,
      })}
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
  const locale = useLocale()
  const [results, setResults] = useState<WikiArticleSearchHit[]>([])
  const [resolvedQuery, setResolvedQuery] = useState("")
  const pendingRef = useRef(0)

  useEffect(() => {
    if (!query.trim()) return

    const id = ++pendingRef.current
    let cancelled = false
    const measured = captureAnalyticsEvent("search_results", {
      interaction_source: "article",
      search_type: "knowledge",
    })
    const failed = captureAnalyticsEvent("search_error", {
      interaction_source: "article",
      search_type: "knowledge",
    })

    searchWikiArticles(query, null, 40, locale)
      .then((res) => {
        if (!cancelled && id === pendingRef.current) {
          setResults(res.hits)
          measured({ result_bucket: resultBucket(res.hits.length) })
          setResolvedQuery(query)
        }
      })
      .catch(() => {
        if (!cancelled && id === pendingRef.current) {
          setResults([])
          failed()
          setResolvedQuery(query)
        }
      })

    return () => {
      cancelled = true
    }
  }, [query, locale])

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
  const tUi = useUiTranslations("ui")

  const searchParams = useSearchParams()
  const query = searchParams.get("q") ?? ""

  return (
    <main className="relative z-10 flex-1">
      <PageHero
        breadcrumb={[
          { label: tUi("home"), href: "/" },
          { label: tUi("knowledge"), href: "/knowledge" },
          { label: tUi("search") },
        ]}
        compact
        eyebrow="Knowledge base"
        eyebrowAccent={DOCS_VERSION}
        eyebrowIcon="mdi:book-open-outline"
        title={
          query
            ? `Results for *“${query.replaceAll("*", "")}”*`
            : "Search the *docs*"
        }
      >
        <form
          method="get"
          {...analyticsAttributes("search", {
            interaction_source: "article",
            search_type: "knowledge",
          })}
        >
          <SearchField
            id="docs-search"
            label={tUi("search_the_knowledge_base")}
            placeholder={tUi(
              "search_the_knowledge_base_eg_contribute_api_run_locally"
            )}
            inputProps={{ name: "q", defaultValue: query, autoComplete: "off" }}
          />
        </form>
      </PageHero>

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
