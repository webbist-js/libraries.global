"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  meiliClient,
  type LibrarySearchHit,
} from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"
import { primaryCtaSm } from "@/lib/styles"

import { StepHeading } from "./WizardFields"

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

const secondaryPill: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  fontWeight: 600,
  color: T.ink.base,
  textDecoration: "none",
  padding: "8px 16px",
  borderRadius: "999px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  whiteSpace: "nowrap",
}

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
  const claimHref = `/contribute/claim?librarySlug=${hit.slug}&libraryName=${encodeURIComponent(hit.name)}${hit.documentId ? `&libraryDocumentId=${hit.documentId}` : ""}${hit.entityRef ? `&libraryEntityRef=${encodeURIComponent(hit.entityRef)}` : ""}`
  // Owners go straight to the edit wizard; everyone else claims first
  // (the edit route redirects non-owners to the claim flow anyway).
  const improveHref = isClaimed ? `/contribute/edit/${hit.slug}` : claimHref
  const isHigh = score === "high"

  return (
    <li
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        padding: "18px 20px",
        borderRadius: "20px",
        border: `1px solid ${isHigh ? "var(--tint-special-fg)" : T.border.line}`,
        background: T.bg.deep,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {isHigh && (
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: T.font.sans,
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--tint-special-fg)",
              margin: "0 0 4px",
            }}
          >
            <Icon icon="mdi:alert-outline" width={16} aria-hidden="true" />
            Possible duplicate
          </p>
        )}
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "20px",
            fontWeight: 500,
            color: T.ink.base,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hit.name}
        </p>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            margin: "2px 0 0",
          }}
        >
          {[hit.libraryType, hit.city, hit.country_name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ flexShrink: 0 }}
      >
        {path && (
          <Link href={path} target="_blank" style={secondaryPill}>
            View
            <span className="sr-only"> {hit.name} (opens in a new tab)</span>
          </Link>
        )}
        <Link
          href={improveHref}
          className={primaryCtaSm}
          style={{ textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Improve this record
        </Link>
        {!isClaimed && (
          <Link
            href={claimHref}
            style={{
              fontFamily: T.font.sans,
              fontSize: "14px",
              fontWeight: 600,
              color: T.accent.primary,
              padding: "8px 4px",
              whiteSpace: "nowrap",
            }}
          >
            Claim library
          </Link>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Gate component
// ---------------------------------------------------------------------------

interface LibrarySearchGateProps {
  onConfirmNew: (prefill: { name: string; city: string }) => void
  claimedEntityRefs?: string[]
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "15px",
  fontWeight: 600,
  margin: "0 0 12px",
}

export function LibrarySearchGate({
  onConfirmNew,
  claimedEntityRefs = [],
}: LibrarySearchGateProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LibrarySearchHit[]>([])
  const [scored, setScored] = useState<SimilarityResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setScored([])
      setHasSearched(false)

      return
    }
    setLoading(true)
    try {
      const res = await meiliClient
        .index("library")
        .search<LibrarySearchHit>(q, {
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
      // One box covers name, town or city — score against both, but a bare
      // city query ("Leeds") shouldn't flag every library in that city.
      setScored(
        res.hits
          .map((h) =>
            similarity(h.city ?? "", q) === 1 ? null : scoreResult(h, q, q)
          )
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
    debounceRef.current = setTimeout(() => void search(query), 380)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const highMatches = scored.filter((s) => s.score === "high")
  const otherResults = results.filter(
    (h) => !highMatches.some((m) => m.hit.id === h.id)
  )
  const noResults = hasSearched && results.length === 0
  const canProceed = query.trim().length >= 2

  let status = ""
  if (loading) status = "Searching…"
  else if (hasSearched)
    status =
      results.length === 0
        ? "No matching libraries found."
        : `${results.length} result${results.length === 1 ? "" : "s"} found.`

  return (
    <div>
      <StepHeading
        eyebrow="Before you start"
        title="Is it already listed?"
        lead="Search first. If the library is already in the index, improving that record helps more than a duplicate."
      />

      {/* Search input */}
      <div
        role="search"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "36px",
        }}
      >
        <label
          htmlFor="gate-query"
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
          }}
        >
          Library name, town or city
        </label>
        <div style={{ position: "relative" }}>
          <Icon
            icon="mdi:magnify"
            width={26}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              color: T.ink.dim,
              pointerEvents: "none",
            }}
          />
          <input
            id="gate-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Leeds"
            autoComplete="off"
            aria-describedby="gate-status"
            autoFocus
            style={{
              height: "64px",
              padding: "0 20px 0 58px",
              borderRadius: "14px",
              border: `2px solid ${T.ink.base}`,
              background: T.bg.deep,
              color: T.ink.base,
              fontSize: "19px",
              fontFamily: T.font.sans,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
        <p
          id="gate-status"
          aria-live="polite"
          style={{
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
            margin: 0,
            minHeight: "1.4em",
          }}
        >
          {status}
        </p>
      </div>

      <div
        style={{
          borderTop: `1px solid ${T.border.line}`,
          margin: "16px 0 28px",
        }}
      />

      {/* Results */}
      {!loading && highMatches.length > 0 && (
        <section
          aria-label="Possible duplicates"
          style={{ marginBottom: "28px" }}
        >
          <p style={{ ...groupLabelStyle, color: "var(--tint-special-fg)" }}>
            {highMatches.length === 1
              ? "Possible duplicate found"
              : `${highMatches.length} possible duplicates found`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
          </ul>
        </section>
      )}

      {!loading && otherResults.length > 0 && (
        <section aria-label="Search results" style={{ marginBottom: "28px" }}>
          {highMatches.length > 0 && (
            <p style={{ ...groupLabelStyle, color: T.ink.dim }}>
              Other results
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
          </ul>
        </section>
      )}

      {!loading && noResults && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
            padding: "18px 20px",
            borderRadius: "20px",
            background: "var(--tint-public-bg)",
            marginBottom: "28px",
          }}
        >
          <Icon
            icon="mdi:check-circle-outline"
            width={22}
            aria-hidden="true"
            style={{ color: "var(--tint-public-fg)", flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--tint-public-fg)",
                margin: "0 0 2px",
              }}
            >
              Nothing found
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "15px",
                color: T.ink.base,
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              No matching library in the index. You&apos;re clear to add it as
              new.
            </p>
          </div>
        </div>
      )}

      {/* CTA row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            margin: 0,
            maxWidth: "44ch",
            lineHeight: 1.5,
          }}
        >
          {canProceed
            ? "Searched and didn't find it? Add it as a new library."
            : "Search first, then add it if it isn't listed."}
        </p>

        <button
          type="button"
          onClick={() => onConfirmNew({ name: query.trim(), city: "" })}
          disabled={!canProceed}
          className={primaryCtaSm}
          style={{
            border: "none",
            cursor: canProceed ? "pointer" : "not-allowed",
            opacity: canProceed ? 1 : 0.45,
            whiteSpace: "nowrap",
          }}
        >
          Not listed — add a new library
          <Icon icon="mdi:arrow-right" width={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
