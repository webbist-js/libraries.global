"use client"

import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { T, tintForLibraryType } from "@/lib/design-tokens"
import { type LibrarySearchHit, searchLibraryNames } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

import { StepHeading } from "./WizardFields"

export const INDEX_EDITOR_PATH = "/contribute/index"

/** A published record with gaps, from fetchIncompleteLibraries. */
export type RecordNeedingHelp = {
  documentId: string
  slug: string
  name: string
  place: string
  libraryType?: string | null
  /** Completeness keys the record is missing, e.g. "photo", "hours". */
  missing: string[]
}

const GAP_LABELS: Record<string, string> = {
  photo: "No photo",
  hours: "No opening hours",
  address: "No address",
  location: "Not on the map",
  facilities: "No facilities listed",
  collections: "No collections info",
  history: "No history",
  contact: "No contact details",
}

function improveHref(slug: string) {
  return `${INDEX_EDITOR_PATH}/${encodeURIComponent(slug)}`
}

function newHref(name: string) {
  const q = name.trim()

  return q
    ? `${INDEX_EDITOR_PATH}/new?name=${encodeURIComponent(q)}`
    : `${INDEX_EDITOR_PATH}/new`
}

const improvePill =
  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-muted-2)"

function Monogram({ libraryType }: { libraryType?: string | null }) {
  const tint = tintForLibraryType(libraryType)

  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: tint.bg, color: tint.fg }}
    >
      <Icon icon="mdi:bank-outline" width={20} />
    </span>
  )
}

function RecordRow({
  name,
  meta,
  libraryType,
  gaps,
  slug,
}: {
  name: string
  meta: string
  libraryType?: string | null
  gaps: string[]
  slug: string
}) {
  return (
    <li
      className="flex flex-col gap-4 sm:flex-row sm:items-center"
      style={{
        padding: "18px 20px",
        borderRadius: "20px",
        border: `1px solid ${T.border.line}`,
        background: T.bg.deep,
      }}
    >
      <Monogram libraryType={libraryType} />
      <div className="min-w-0 flex-1">
        <p
          className="m-0 truncate"
          style={{
            fontFamily: T.font.serif,
            fontSize: "22px",
            fontWeight: 500,
            color: T.ink.base,
            lineHeight: 1.2,
          }}
        >
          {name}
        </p>
        <p
          className="mt-0.5 mb-0 truncate text-[15px]"
          style={{ color: T.ink.dim }}
        >
          {meta}
        </p>
        {gaps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gaps.map((gap) => (
              <span
                key={gap}
                className="rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold"
                style={{
                  background: "var(--tint-special-bg)",
                  color: "var(--tint-special-fg)",
                }}
              >
                {gap}
              </span>
            ))}
          </div>
        )}
      </div>
      <Link
        href={improveHref(slug)}
        className={improvePill}
        style={{
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
        }}
      >
        <Icon icon="mdi:pencil-outline" width={16} aria-hidden="true" />
        Improve this record
        <span className="sr-only">: {name}</span>
      </Link>
    </li>
  )
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "15px",
  fontWeight: 600,
  margin: 0,
  color: T.ink.base,
}

/**
 * The Index editor's front door: search the index, improve a record that's
 * there, or add a new library when it isn't. Shows a handful of published
 * records with gaps while the search box is empty.
 */
export function FindLibraryFirst({
  needsHelp,
}: {
  readonly needsHelp: readonly RecordNeedingHelp[]
}) {
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LibrarySearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        setHasSearched(false)

        return
      }
      setLoading(true)
      try {
        const res = await searchLibraryNames(q, {
          locale,
          hitsPerPage: 8,
          attributesToRetrieve: [
            "id",
            "documentId",
            "name",
            "slug",
            "entityRef",
            "libraryType",
            "city",
            "country_name",
            "region_name",
          ],
        })
        setResults(res.hits)
        setHasSearched(true)
      } catch {
        setResults([])
        setHasSearched(true)
      } finally {
        setLoading(false)
      }
    },
    [locale]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(query), 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const typing = query.trim().length > 0
  const canAdd = query.trim().length >= 2
  let status = ""
  if (loading) status = "Searching…"
  else if (hasSearched)
    status =
      results.length === 0
        ? "No matching libraries in the index."
        : `${results.length} result${results.length === 1 ? "" : "s"}`
  else if (typing) status = "Type 2 or more letters to search"

  return (
    <div>
      <StepHeading
        eyebrow="Start here"
        title="Find the library first."
        lead="If it’s already in the index, improve that record. If it isn’t, you can add it as a new library. It’s the same form either way."
      />

      <div
        role="search"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "32px",
        }}
      >
        <label
          htmlFor="index-query"
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
            id="index-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Radlett, or Glasgow"
            autoComplete="off"
            aria-describedby="index-status"
            autoFocus
            style={{
              height: "64px",
              padding: "0 20px 0 58px",
              borderRadius: "14px",
              border: `2px solid ${T.accent.primary}`,
              background: T.bg.deep,
              color: T.ink.base,
              fontSize: "19px",
              fontFamily: T.font.sans,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div className="mt-5 mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p style={groupLabelStyle}>
          {hasSearched ? "Results" : "Records that need help"}
        </p>
        <p
          id="index-status"
          aria-live="polite"
          className="m-0 text-[14px]"
          style={{ color: T.ink.dim, minHeight: "1.4em" }}
        >
          {status || "Type 2 or more letters to search"}
        </p>
      </div>

      {hasSearched ? (
        results.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {results.map((hit) => (
              <RecordRow
                key={hit.id}
                name={hit.name}
                meta={[
                  hit.libraryType ? `${hit.libraryType} library` : null,
                  [hit.city, hit.country_name].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                libraryType={hit.libraryType}
                gaps={[]}
                slug={hit.slug}
              />
            ))}
          </ul>
        ) : (
          <div
            className="flex items-start gap-3 rounded-[20px] px-5 py-4"
            style={{ background: "var(--tint-public-bg)" }}
          >
            <Icon
              icon="mdi:check-circle-outline"
              width={22}
              aria-hidden="true"
              style={{ color: "var(--tint-public-fg)", flexShrink: 0 }}
            />
            <p
              className="m-0 text-[15px] leading-[1.55]"
              style={{ color: T.ink.base }}
            >
              <strong style={{ color: "var(--tint-public-fg)" }}>
                Nothing found.
              </strong>{" "}
              No matching library in the index. You’re clear to add it as new.
            </p>
          </div>
        )
      ) : needsHelp.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {needsHelp.map((record) => (
            <RecordRow
              key={record.documentId}
              name={record.name}
              meta={[
                record.libraryType ? `${record.libraryType} library` : null,
                record.place,
              ]
                .filter(Boolean)
                .join(" · ")}
              libraryType={record.libraryType}
              gaps={record.missing
                .map((key) => GAP_LABELS[key])
                .filter((label): label is string => !!label)
                .slice(0, 3)}
              slug={record.slug}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          Every published record is complete. Search for one to improve, or add
          a new library below.
        </p>
      )}

      {/* Not listed? */}
      <div
        className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[20px] px-6 py-5"
        style={{ border: `1.5px dashed ${T.border.hi}` }}
      >
        <div>
          <p
            className="m-0 text-[17px] font-semibold"
            style={{ color: T.ink.base }}
          >
            Not listed?
          </p>
          <p className="m-0 mt-0.5 text-[15px]" style={{ color: T.ink.dim }}>
            {canAdd
              ? "Searched and didn’t find it? Add it as a new library."
              : "Search first. Then you can add it if it’s missing."}
          </p>
        </div>
        <Link
          href={newHref(query)}
          aria-disabled={!canAdd}
          className={`${improvePill} ${canAdd ? "" : "pointer-events-none opacity-50"}`}
          style={{
            border: "none",
            background: canAdd ? T.accent.primary : T.bg.muted,
            color: canAdd ? "#fff" : T.ink.dim,
          }}
        >
          <Icon icon="mdi:plus" width={18} aria-hidden="true" />
          Add a new library
        </Link>
      </div>
    </div>
  )
}
