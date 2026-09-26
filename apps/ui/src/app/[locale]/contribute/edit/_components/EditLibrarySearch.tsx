"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState, useEffect, useRef } from "react"

import { SearchField } from "@/components/ds"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type { ClaimedLibrary } from "@/lib/types/profile"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

interface LibraryResult {
  documentId: string
  slug: string
  name: string
  city?: string | null
  entityRef?: string | null
  libraryType?: string | null
}

const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}

const headingStyle: React.CSSProperties = {
  fontFamily: T.font.serif,
  fontSize: "clamp(22px,2.4vw,26px)",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  color: T.ink.base,
}

const rowClass =
  "flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-transparent px-5 py-4 text-left transition-colors hover:bg-(--t-bg-surface) sm:px-6"

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
  const [claimedLibraries, setClaimedLibraries] = useState<ClaimedLibrary[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((json: { libraries?: ClaimedLibrary[] }) => {
        setClaimedLibraries(json.libraries ?? [])
      })
      .catch(() => {})
  }, [])

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

  const claimedEntityRefs = new Set(
    claimedLibraries.map((l) => l.entityRef).filter(Boolean)
  )

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Edit the index"
        title="Find a library *to edit.*"
        lead="Search by name or city. Only libraries you've claimed can be edited. Select one to open the editor."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="max-w-[820px]">
          {/* Claimed libraries */}
          {claimedLibraries.length > 0 && (
            <section aria-labelledby="claimed-heading" className="mb-10">
              <h2
                id="claimed-heading"
                className="m-0 mb-4"
                style={headingStyle}
              >
                Your claimed libraries
              </h2>
              <ul
                className="m-0 list-none overflow-hidden rounded-[20px] p-0"
                style={cardStyle}
              >
                {claimedLibraries.map((lib, index) => {
                  const tint = tintForLibraryType(lib.libraryType)

                  return (
                    <li
                      key={lib.entityRef ?? lib.documentId}
                      style={
                        index > 0
                          ? { borderTop: `1px solid ${T.border.divider}` }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/contribute/edit/${lib.slug ?? ""}`)
                        }
                        className={rowClass}
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span
                            className="truncate text-[16px] font-semibold"
                            style={{ color: T.ink.base }}
                          >
                            {lib.name}
                          </span>
                          {lib.entityRef && (
                            <span
                              className="text-[14px]"
                              style={{
                                color: T.ink.dim,
                                fontFamily: T.font.mono,
                              }}
                            >
                              {lib.entityRef}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center gap-3">
                          {lib.libraryType && (
                            <span
                              className="rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap"
                              style={{ background: tint.bg, color: tint.fg }}
                            >
                              {lib.libraryType}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center gap-1 text-[14px] font-semibold"
                            style={{ color: T.accent.primary }}
                          >
                            Edit
                            <Icon
                              icon="mdi:arrow-right"
                              width={16}
                              height={16}
                              aria-hidden="true"
                            />
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Search */}
          <section aria-labelledby="search-heading">
            <h2 id="search-heading" className="m-0 mb-4" style={headingStyle}>
              Search the index
            </h2>
            <div className="mb-5">
              <SearchField
                id="edit-library-search"
                placeholder="Search libraries by name or place"
                loading={loading}
                inputRef={inputRef}
                onClear={() => setQuery("")}
                inputProps={{
                  value: query,
                  onChange: (e) => setQuery(e.target.value),
                  autoFocus: true,
                  autoComplete: "off",
                }}
              />
            </div>

            <p aria-live="polite" className="sr-only">
              {results.length > 0
                ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                : ""}
            </p>

            {/* Results */}
            {results.length > 0 && (
              <div>
                <p
                  className="m-0 mb-3 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </p>
                <ul
                  className="m-0 list-none overflow-hidden rounded-[20px] p-0"
                  style={cardStyle}
                >
                  {results.map((lib, index) => {
                    const isClaimed =
                      lib.entityRef != null &&
                      claimedEntityRefs.has(lib.entityRef)
                    const tint = tintForLibraryType(lib.libraryType)

                    return (
                      <li
                        key={lib.documentId}
                        style={
                          index > 0
                            ? { borderTop: `1px solid ${T.border.divider}` }
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isClaimed) {
                              router.push(`/contribute/edit/${lib.slug}`)
                            } else {
                              router.push(
                                `/contribute/claim?librarySlug=${encodeURIComponent(lib.slug)}&libraryName=${encodeURIComponent(lib.name)}&libraryDocumentId=${encodeURIComponent(lib.documentId)}${lib.entityRef ? `&libraryEntityRef=${encodeURIComponent(lib.entityRef)}` : ""}`
                              )
                            }
                          }}
                          className={rowClass}
                        >
                          {/* Left: name + meta */}
                          <span className="flex min-w-0 flex-col gap-1">
                            <span
                              className="truncate text-[16px] font-semibold"
                              style={{ color: T.ink.base }}
                            >
                              {lib.name}
                            </span>
                            {(lib.city || lib.entityRef) && (
                              <span
                                className="text-[14px]"
                                style={{ color: T.ink.dim }}
                              >
                                {lib.city}
                                {lib.city && lib.entityRef ? " · " : null}
                                {lib.entityRef && (
                                  <span style={{ fontFamily: T.font.mono }}>
                                    {lib.entityRef}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>

                          {/* Right: type chip + action */}
                          <span className="flex shrink-0 flex-wrap items-center gap-3">
                            {lib.libraryType && (
                              <span
                                className="rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap"
                                style={{ background: tint.bg, color: tint.fg }}
                              >
                                {lib.libraryType}
                              </span>
                            )}
                            {isClaimed ? (
                              <span
                                className="inline-flex items-center gap-1 text-[14px] font-semibold"
                                style={{ color: T.accent.primary }}
                              >
                                Edit
                                <Icon
                                  icon="mdi:arrow-right"
                                  width={16}
                                  height={16}
                                  aria-hidden="true"
                                />
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap"
                                style={{
                                  background: T.bg.deep,
                                  border: `1px solid ${T.border.hi}`,
                                  color: T.ink.dim,
                                }}
                              >
                                <Icon
                                  icon="mdi:lock-outline"
                                  width={14}
                                  height={14}
                                  aria-hidden="true"
                                />
                                Claim to edit
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Empty state */}
            {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
              <div
                className="rounded-[20px] px-6 py-10 text-center"
                style={cardStyle}
              >
                <p
                  className="m-0 mb-1"
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "22px",
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  No results
                </p>
                <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                  No libraries matched &ldquo;{debouncedQuery}&rdquo;.
                </p>
              </div>
            )}

            {/* Idle prompt */}
            {!loading && debouncedQuery.length < 2 && (
              <p
                className="m-0 py-6 text-center text-[15px]"
                style={{ color: T.ink.dim }}
              >
                Type at least 2 characters to search
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
