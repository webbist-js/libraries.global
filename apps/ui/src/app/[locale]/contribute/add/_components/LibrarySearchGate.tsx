"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  meiliClient,
  type LibrarySearchHit,
} from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimilarityResult {
  hit: LibrarySearchHit
  score: "high" | "medium"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  if (al === bl) return 1
  if (al.includes(bl) || bl.includes(al)) return 0.8
  // word overlap
  const aw = new Set(al.split(/\W+/).filter(Boolean))
  const bw = new Set(bl.split(/\W+/).filter(Boolean))
  const shared = [...aw].filter((w) => bw.has(w)).length

  return shared / Math.max(aw.size, bw.size, 1)
}

function scoreResult(
  hit: LibrarySearchHit,
  query: string,
  city: string
): SimilarityResult | null {
  const nameSim = similarity(hit.name, query)
  const citySim = city ? similarity(hit.city ?? "", city) : 0

  if (nameSim >= 0.8) return { hit, score: citySim > 0.4 ? "high" : "medium" }
  if (nameSim >= 0.5 && citySim >= 0.6) return { hit, score: "medium" }

  return null
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({
  hit,
  score,
  isClaimed,
}: {
  hit: LibrarySearchHit
  score: "high" | "medium"
  isClaimed: boolean
}) {
  const path = buildLibraryPath(hit)

  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: "10px",
        border: `1px solid ${score === "high" ? T.accent.warn + "40" : T.border.line}`,
        background: score === "high" ? "rgba(255,207,122,0.04)" : T.bg.surface,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {score === "high" && (
          <div
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.warn,
              marginBottom: "4px",
            }}
          >
            ⚠ Possible duplicate
          </div>
        )}
        <div
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
          {hit.name}
        </div>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: T.ink.faint,
            marginTop: "3px",
          }}
        >
          {[hit.libraryType, hit.city, hit.country_name]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
        {path && (
          <Link
            href={path}
            target="_blank"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              border: `1px solid ${T.border.line}`,
            }}
          >
            View →
          </Link>
        )}
        {isClaimed ? (
          <Link
            href={`/contribute/edit?slug=${hit.slug}`}
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              border: `1px solid rgba(127,223,255,0.28)`,
              background: "rgba(127,223,255,0.06)",
            }}
          >
            Suggest edit →
          </Link>
        ) : (
          <Link
            href={`/contribute/claim?librarySlug=${hit.slug}&libraryName=${encodeURIComponent(hit.name)}${hit.documentId ? `&libraryDocumentId=${hit.documentId}` : ""}${hit.entityRef ? `&libraryEntityRef=${encodeURIComponent(hit.entityRef)}` : ""}`}
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.accent.violet,
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              border: `1px solid rgba(163,144,255,0.28)`,
              background: "rgba(163,144,255,0.06)",
            }}
          >
            Claim library →
          </Link>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gate component
// ---------------------------------------------------------------------------

interface LibrarySearchGateProps {
  onConfirmNew: (prefill: { name: string; city: string }) => void
  claimedEntityRefs?: string[]
}

export function LibrarySearchGate({
  onConfirmNew,
  claimedEntityRefs = [],
}: LibrarySearchGateProps) {
  const [query, setQuery] = useState("")
  const [city, setCity] = useState("")
  const [results, setResults] = useState<LibrarySearchHit[]>([])
  const [scored, setScored] = useState<SimilarityResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string, c: string) => {
    if (q.trim().length < 2 && c.trim().length < 2) {
      setResults([])
      setScored([])
      setHasSearched(false)

      return
    }
    setLoading(true)
    try {
      const searchQuery = [q, c].filter(Boolean).join(" ")
      const res = await meiliClient
        .index("library")
        .search<LibrarySearchHit>(searchQuery, {
          hitsPerPage: 8,
          attributesToRetrieve: [
            "id",
            "documentId",
            "name",
            "slug",
            "entityRef",
            "libraryType",
            "operationalStatus",
            "city",
            "country_name",
            "continent_slug",
            "country_slug",
            "region_slug",
          ],
        })
      setResults(res.hits)
      setScored(
        res.hits
          .map((h) => scoreResult(h, q, c))
          .filter((r): r is SimilarityResult => r !== null)
      )
      setHasSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(query, city), 380)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, city, search])

  const highMatches = scored.filter((s) => s.score === "high")
  const otherResults = results.filter(
    (h) => !highMatches.some((m) => m.hit.id === h.id)
  )
  const noResults = hasSearched && results.length === 0
  const canProceed = query.trim().length >= 2 || city.trim().length >= 2

  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        padding: "48px 24px 60px",
      }}
    >
      {/* Header */}
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".20em",
          textTransform: "uppercase",
          color: T.accent.aurora,
          opacity: 0.7,
          margin: "0 0 16px",
        }}
      >
        Step 0 · Duplicate check
      </p>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: T.ink.base,
          margin: "0 0 10px",
        }}
      >
        Is this library already indexed?
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          margin: "0 0 32px",
          lineHeight: 1.65,
          maxWidth: "52ch",
        }}
      >
        Search by name or city before adding. If you find it, claim it as yours
        or suggest an edit — duplicates slow down the review queue.
      </p>

      {/* Search inputs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="gate-name"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Library name
          </label>
          <input
            id="gate-name"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder=""
            autoFocus
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: `1px solid ${T.border.hi}`,
              background: T.bg.surface,
              color: T.ink.base,
              fontSize: "14px",
              fontFamily: T.font.sans,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="gate-city"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            City or postcode
          </label>
          <input
            id="gate-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder=""
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: `1px solid ${T.border.hi}`,
              background: T.bg.surface,
              color: T.ink.base,
              fontSize: "14px",
              fontFamily: T.font.sans,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: "16px 0",
          }}
        >
          Searching…
        </div>
      )}

      {!loading && highMatches.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.warn,
              margin: "0 0 10px",
            }}
          >
            {highMatches.length === 1
              ? "Possible duplicate found"
              : `${highMatches.length} possible duplicates found`}
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {highMatches.map((r) => (
              <ResultCard
                key={r.hit.id}
                hit={r.hit}
                score={r.score}
                isClaimed={
                  !!r.hit.entityRef &&
                  claimedEntityRefs.includes(r.hit.entityRef)
                }
              />
            ))}
          </div>
        </div>
      )}

      {!loading && otherResults.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          {highMatches.length > 0 && (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
                margin: "0 0 10px",
              }}
            >
              Other results
            </p>
          )}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {otherResults.map((hit) => (
              <ResultCard
                key={hit.id}
                hit={hit}
                score="medium"
                isClaimed={
                  !!hit.entityRef && claimedEntityRefs.includes(hit.entityRef)
                }
              />
            ))}
          </div>
        </div>
      )}

      {!loading && noResults && (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "10px",
            border: `1px solid ${T.accent.ok}30`,
            background: "rgba(142,240,179,0.03)",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.ok,
              margin: "0 0 3px",
            }}
          >
            Nothing found
          </p>
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.dim,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            No matching library found in the index. You&apos;re clear to add it
            as new.
          </p>
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          borderTop: `1px solid ${T.border.line}`,
          margin: "24px 0 20px",
        }}
      />

      {/* CTA row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
            margin: 0,
            maxWidth: "40ch",
            lineHeight: 1.5,
          }}
        >
          {canProceed
            ? "Searched and didn't find it? Proceed to add as new."
            : "Search first, then add if not found."}
        </p>

        <button
          type="button"
          onClick={() =>
            onConfirmNew({ name: query.trim(), city: city.trim() })
          }
          disabled={!canProceed}
          style={{
            padding: "11px 24px",
            borderRadius: "10px",
            border: canProceed
              ? `1px solid rgba(127,223,255,0.35)`
              : `1px solid ${T.border.line}`,
            background: canProceed ? "rgba(127,223,255,0.10)" : T.bg.surface,
            color: canProceed ? T.accent.aurora : T.ink.faint,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            cursor: canProceed ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          Not in index — add new library →
        </button>
      </div>
    </div>
  )
}
