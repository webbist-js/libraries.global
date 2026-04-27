"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"

import { T } from "@/lib/design-tokens"

interface LibraryResult {
  documentId: string
  slug: string
  name: string
  city?: string | null
  entityRef?: string | null
  libraryType?: string | null
}

function useDebounce<V>(value: V, delay: number): V {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function EditLibrarySearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LibraryResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    let cancelled = false

    async function runSearch() {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([])
        setLoading(false)

        return
      }
      setLoading(true)
      try {
        const r = await fetch(
          `/api/search/libraries?q=${encodeURIComponent(debouncedQuery)}`
        )
        const json = (await r.json()) as {
          data?: {
            documentId: string
            slug?: string
            name?: string
            city?: string | null
            entityRef?: string | null
            libraryType?: string | null
          }[]
        }
        if (!cancelled) {
          setResults(
            (json.data ?? []).map((item) => ({
              documentId: item.documentId,
              slug: item.slug ?? "",
              name: item.name ?? "",
              city: item.city ?? null,
              entityRef: item.entityRef ?? null,
              libraryType: item.libraryType ?? null,
            }))
          )
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void runSearch()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "48px 24px" }}>
      {/* Breadcrumb */}
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "20px",
        }}
      >
        Contribute / Edit a Library
      </p>

      {/* Heading */}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontWeight: 700,
          fontSize: "clamp(2rem, 5vw, 3rem)",
          color: T.ink.base,
          margin: "0 0 12px",
          lineHeight: 1.1,
        }}
      >
        Find a library to edit.
      </h1>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          marginBottom: "32px",
          lineHeight: 1.6,
        }}
      >
        Search by name, city, or entity reference. Select a library to open the
        diff editor.
      </p>

      {/* Search input */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <span
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            color: T.ink.faint,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <Icon icon="mdi:magnify" width={18} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search libraries…"
          autoFocus
          style={{
            width: "100%",
            padding: "14px 18px 14px 46px",
            border: `1px solid ${T.border.hi}`,
            borderRadius: "12px",
            background: "rgba(255,255,255,0.04)",
            color: T.ink.base,
            fontSize: "15px",
            fontFamily: T.font.sans,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: T.ink.faint,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Icon icon="mdi:loading" width={16} className="animate-spin" />
          </span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          {results.map((lib) => (
            <button
              key={lib.documentId}
              onClick={() => router.push(`/contribute/edit/${lib.slug}`)}
              style={{
                padding: "14px 18px",
                border: `1px solid ${T.border.line}`,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                cursor: "pointer",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.05)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                  T.border.hi
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.02)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                  T.border.line
              }}
            >
              {/* Left: name + meta */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    color: T.ink.base,
                    fontWeight: 500,
                  }}
                >
                  {lib.name}
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {[lib.city, lib.entityRef].filter(Boolean).join(" · ")}
                </span>
              </div>

              {/* Right: type chip + arrow */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexShrink: 0,
                }}
              >
                {lib.libraryType && (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                      border: `1px solid ${T.border.line}`,
                      borderRadius: "6px",
                      padding: "3px 8px",
                    }}
                  >
                    {lib.libraryType}
                  </span>
                )}
                <Icon icon="mdi:arrow-right" width={16} color={T.ink.faint} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
            textAlign: "center",
            padding: "32px 0",
          }}
        >
          No libraries found for &ldquo;{debouncedQuery}&rdquo;.
        </p>
      )}
    </div>
  )
}
