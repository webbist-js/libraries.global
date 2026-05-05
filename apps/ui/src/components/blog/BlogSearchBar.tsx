"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  searchBlogArticles,
  type BlogArticleSearchHit,
} from "@/lib/meilisearch"

export function BlogSearchBar() {
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
      {/* Input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 14px",
          borderRadius: open && results.length > 0 ? "12px 12px 0 0" : "12px",
          border: `1px solid ${T.border.hi}`,
          borderBottom:
            open && results.length > 0
              ? `1px solid ${T.border.line}`
              : undefined,
          background: "rgba(8,12,30,.5)",
          backdropFilter: "blur(8px)",
          transition: "border-radius 100ms",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          style={{
            color: loading ? T.accent.ember : T.ink.low,
            flexShrink: 0,
            transition: "color 200ms",
          }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search articles, authors, topics…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: T.ink.base,
            fontSize: "13px",
            fontFamily: T.font.mono,
            letterSpacing: ".02em",
          }}
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("")
              setOpen(false)
              inputRef.current?.focus()
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.ink.faint,
              fontSize: "16px",
              lineHeight: 1,
              padding: "0 2px",
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : (
          <span
            style={{
              padding: "3px 7px",
              borderRadius: "5px",
              background: T.bg.deep,
              border: `1px solid ${T.border.hi}`,
              fontSize: "10px",
              color: T.ink.dim,
              fontFamily: T.font.mono,
            }}
          >
            ⌘K
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "rgba(6,9,22,.96)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${T.border.hi}`,
            borderTop: "none",
            borderRadius: "0 0 12px 12px",
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
              className="hover:bg-[rgba(255,184,138,.04)]"
            >
              <span
                style={{
                  fontSize: "13px",
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
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
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
                gap: "8px",
                padding: "10px 14px",
                borderTop: `1px solid ${T.border.line}`,
                textDecoration: "none",
                fontSize: "11px",
                color: T.accent.ember,
                fontFamily: T.font.mono,
                letterSpacing: ".06em",
              }}
              className="hover:bg-[rgba(255,184,138,.04)]"
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
