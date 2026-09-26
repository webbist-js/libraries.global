"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { SearchField } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  searchBlogArticles,
  type BlogArticleSearchHit,
} from "@/lib/meilisearch"

export function BlogSearchBar({ inputId }: { readonly inputId?: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BlogArticleSearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)

      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchBlogArticles(query, 8)
        setResults(res.hits)
        setOpen(res.hits.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)

    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/blog/search?q=${encodeURIComponent(query.trim())}`)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <SearchField
        id={inputId ?? "blog-search"}
        placeholder="Search articles, authors or topics"
        loading={loading}
        inputRef={inputRef}
        onClear={() => {
          setQuery("")
          setOpen(false)
          inputRef.current?.focus()
        }}
        inputProps={{
          value: query,
          onChange: (e) => setQuery(e.target.value),
          onFocus: () => results.length > 0 && setOpen(true),
          onKeyDown: handleKeyDown,
          autoComplete: "off",
        }}
      />

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            boxShadow: "0 12px 28px rgba(23,22,43,.08)",
            borderRadius: "16px",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {results.map((hit, i) => (
            <GlobalLink
              key={hit.documentId}
              href={`/blog/${hit.section_slug ?? "general"}/${hit.slug}`}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                padding: "11px 14px",
                borderTop: i > 0 ? `1px solid ${T.border.line}` : undefined,
                textDecoration: "none",
                transition: "background 150ms",
              }}
              className="hover:bg-(--t-bg-surface)"
            >
              <span
                style={{
                  fontSize: "15px",
                  color: T.ink.base,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hit.title ?? hit.slug}
              </span>
              {hit.section_slug && (
                <span style={{ fontSize: "13px", color: T.ink.dim }}>
                  {hit.section_slug}
                </span>
              )}
            </GlobalLink>
          ))}
          {query.trim() && (
            <GlobalLink
              href={`/blog/search?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderTop: `1px solid ${T.border.line}`,
                textDecoration: "none",
                fontSize: "14px",
                color: T.accent.primary,
                fontWeight: 600,
              }}
              className="hover:bg-(--t-bg-surface)"
            >
              View all results for &ldquo;{query}&rdquo; →
            </GlobalLink>
          )}
        </div>
      )}
    </div>
  )
}

export default BlogSearchBar
