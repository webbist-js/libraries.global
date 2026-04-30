"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"

import { ContributeHeroShell } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { ContributeNavBar } from "../../_components/ContributeNavBar"

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
    <>
      {/* Hero */}
      <ContributeHeroShell minHeight="300px">
        <div
          className="relative z-10 mx-auto w-full max-w-[900px]"
          style={{ padding: "112px 24px 40px" }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".20em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: "0 0 20px",
            }}
          >
            <Link
              href="/contribute"
              style={{ color: T.ink.faint, textDecoration: "none" }}
              className="transition-colors hover:text-white/60"
            >
              Contribute
            </Link>
            <span style={{ margin: "0 8px", opacity: 0.4 }}>/</span>
            <span style={{ color: T.ink.low }}>Edit a library</span>
          </p>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontWeight: 700,
              fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              color: T.ink.base,
              margin: "0 0 16px",
            }}
          >
            Find a library{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: T.accent.aurora,
              }}
            >
              to edit.
            </em>
          </h1>
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "14px",
              color: T.ink.dim,
              maxWidth: "48ch",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Search by name or city. Only libraries you&apos;ve claimed can be
            edited — select one to open the wizard.
          </p>
        </div>
      </ContributeHeroShell>

      <ContributeNavBar />

      {/* Search content */}
      <div
        style={{
          background: T.bg.space,
          minHeight: "60vh",
        }}
      >
        <div
          style={{
            maxWidth: "768px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
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
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  margin: "0 0 12px",
                }}
              >
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {results.map((lib) => (
                  <button
                    key={lib.documentId}
                    onClick={() => router.push(`/contribute/edit/${lib.slug}`)}
                    style={{
                      padding: "16px 20px",
                      border: `1px solid ${T.border.line}`,
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      textAlign: "left",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = "rgba(127,223,255,0.04)"
                      el.style.borderColor = "rgba(127,223,255,0.22)"
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = "rgba(255,255,255,0.02)"
                      el.style.borderColor = T.border.line
                    }}
                  >
                    {/* Left: name + meta */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "15px",
                          fontWeight: 500,
                          color: T.ink.base,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lib.name}
                      </span>
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".12em",
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
                        gap: "12px",
                        flexShrink: 0,
                        marginLeft: "16px",
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
                            padding: "4px 9px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {lib.libraryType}
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "12px",
                          color: T.accent.aurora,
                          opacity: 0.7,
                        }}
                      >
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div
              style={{
                padding: "32px 0",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  margin: "0 0 6px",
                }}
              >
                No results
              </p>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  color: T.ink.faint,
                  margin: 0,
                  opacity: 0.7,
                }}
              >
                No libraries matched &ldquo;{debouncedQuery}&rdquo;.
              </p>
            </div>
          )}

          {/* Idle prompt */}
          {!loading && debouncedQuery.length < 2 && (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
                textAlign: "center",
                padding: "40px 0",
                opacity: 0.5,
              }}
            >
              Type at least 2 characters to search
            </p>
          )}
        </div>
      </div>
    </>
  )
}
