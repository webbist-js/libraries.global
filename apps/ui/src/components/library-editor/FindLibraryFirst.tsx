"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useRef, useState, type Ref } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SearchField } from "@/components/ds/SearchField"
import { StepHeading } from "@/components/library-editor/WizardFields"
import { Button, buttonVariants } from "@/components/ui/button"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { type LibrarySearchHit, searchLibraryNames } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

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
  about: "No collections info",
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

const improvePill = cn(buttonVariants({ variant: "surface", size: "pill" }))

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
  pageHref,
  onClaim,
  claimLabel,
}: {
  name: string
  meta: string
  libraryType?: string | null
  gaps: string[]
  slug: string
  /** Claim entry point when no inline selection handler is provided. */
  pageHref?: string | null
  onClaim?: () => void
  claimLabel?: string
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
          className="m-0 break-words"
          style={{
            fontFamily: T.font.sans,
            fontSize: "22px",
            fontWeight: 500,
            color: T.ink.base,
            lineHeight: 1.2,
          }}
        >
          {name}
        </p>
        <p
          className="mt-1 mb-0 text-base leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          {meta}
        </p>
        {gaps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gaps.map((gap) => (
              <Badge key={gap} label={gap} color="dim" />
            ))}
          </div>
        )}
      </div>
      {onClaim ? (
        <Button
          variant="primary"
          size="pill"
          className="w-full sm:w-auto"
          onClick={onClaim}
        >
          <Icon icon="mdi:shield-check-outline" width={18} aria-hidden />
          {claimLabel}
          <span className="sr-only">: {name}</span>
        </Button>
      ) : (
        <Link
          href={pageHref ?? improveHref(slug)}
          className={improvePill}
          style={{
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
          }}
        >
          <Icon
            icon={pageHref ? "mdi:bank-outline" : "mdi:pencil-outline"}
            width={16}
            aria-hidden="true"
          />
          {pageHref ? claimLabel : "Improve this record"}
          <span className="sr-only">: {name}</span>
        </Link>
      )}
    </li>
  )
}

function searchStatus(
  loading: boolean,
  failed: boolean,
  hasSearched: boolean,
  count: number
) {
  const status = loading
    ? "Searching…"
    : failed
      ? "Search is unavailable. Try again before adding a record."
      : hasSearched
        ? `${count} matching librar${count === 1 ? "y" : "ies"}`
        : "Type 2 or more letters to search"

  return status
}

function SearchResultsHeader({
  claiming,
  hasSearched,
  loading,
  failed,
  status,
}: {
  claiming: boolean
  hasSearched: boolean
  loading: boolean
  failed: boolean
  status: string
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div
      className={cn(
        "mt-5 mb-4 flex flex-wrap items-baseline gap-2",
        claiming && !hasSearched && !loading && !failed
          ? "justify-start"
          : "justify-between"
      )}
    >
      {!claiming || hasSearched || loading || failed ? (
        <h3 className="type-small-heading m-0">
          {hasSearched
            ? tUi("results")
            : claiming
              ? "Your library"
              : "Records that need help"}
        </h3>
      ) : null}
      <p
        id="index-status"
        role="status"
        className="m-0 text-sm text-(--t-ink-dim)"
      >
        {status}
      </p>
    </div>
  )
}

type SearchResultProps = {
  results: readonly LibrarySearchHit[]
  claiming: boolean
  onChooseLibrary?: (library: LibrarySearchHit) => void
}
function FoundLibraryResults({
  results,
  claiming,
  onChooseLibrary,
}: SearchResultProps) {
  const tClaim = useUiTranslations("libraryClaim")
  if (!results.length)
    return (
      <Notice icon="mdi:magnify" tone="info" title="No matching library found">
        <p className="m-0">
          Try another name or spelling before adding a new record.
        </p>
      </Notice>
    )

  return (
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
          pageHref={
            claiming
              ? `/contribute/claim?librarySlug=${encodeURIComponent(hit.slug)}&libraryName=${encodeURIComponent(hit.name)}&libraryDocumentId=${encodeURIComponent(hit.documentId)}&libraryEntityRef=${encodeURIComponent(hit.entityRef ?? "")}`
              : undefined
          }
          onClaim={
            claiming && onChooseLibrary ? () => onChooseLibrary(hit) : undefined
          }
          claimLabel={tClaim("claimThis")}
        />
      ))}
    </ul>
  )
}

function LibrarySearchResults({
  results,
  claiming,
  onChooseLibrary,
  hasSearched,
  loading,
  failed,
  needsHelp,
}: SearchResultProps & {
  hasSearched: boolean
  loading: boolean
  failed: boolean
  needsHelp: readonly RecordNeedingHelp[]
}) {
  const tUi = useUiTranslations("ui")
  if (hasSearched)
    return (
      <FoundLibraryResults
        results={results}
        claiming={claiming}
        onChooseLibrary={onChooseLibrary}
      />
    )
  if (loading || failed || claiming) return null
  if (!needsHelp.length)
    return (
      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
        No suggested records are available right now. Search for a library to
        improve.
      </p>
    )

  return (
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
            .map((key) =>
              key === "hours" && record.libraryType === "Mobile"
                ? tUi("no_stops_or_times")
                : GAP_LABELS[key]
            )
            .filter((label): label is string => !!label)
            .slice(0, 3)}
          slug={record.slug}
        />
      ))}
    </ul>
  )
}

/**
 * The Index editor's front door: search the index, improve a record that's
 * there, or add a new library when it isn't. Shows a handful of published
 * records with gaps while the search box is empty.
 */
export function FindLibraryFirst({
  needsHelp,
  intent = "edit",
  onChooseLibrary,
  newLibraryHref,
  headingRef,
}: {
  readonly needsHelp: readonly RecordNeedingHelp[]
  /** Claim uses the same search, then opens the affiliation form directly. */
  readonly intent?: "edit" | "claim"
  readonly onChooseLibrary?: (library: LibrarySearchHit) => void
  readonly newLibraryHref?: string
  readonly headingRef?: Ref<HTMLHeadingElement>
}) {
  const tUi = useUiTranslations("ui")
  const tClaim = useUiTranslations("libraryClaim")

  const claiming = intent === "claim"
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LibrarySearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const queryRef = useRef(query)
  const handleQuery = (value: string) => {
    queryRef.current = value
    setQuery(value)
    setResults([])
    setFailed(false)
    setHasSearched(false)
    setLoading(value.trim().length >= 2)
  }
  const handleRetry = () => {
    setFailed(false)
    setLoading(true)
    setAttempt((value) => value + 1)
  }
  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    if (q.length < 2) return
    const timer = setTimeout(() => {
      searchLibraryNames(q, {
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
          "continent_slug",
          "country_slug",
          "region_slug",
        ],
      })
        .then((res) => {
          if (!cancelled && queryRef.current.trim() === q) {
            setResults(res.hits)
            setHasSearched(true)
          }
        })
        .catch(() => {
          if (!cancelled && queryRef.current.trim() === q) setFailed(true)
        })
        .finally(() => {
          if (!cancelled && queryRef.current.trim() === q) setLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, locale, attempt])
  const canAdd = query.trim().length >= 2 && hasSearched && !failed && !loading
  const status = searchStatus(loading, failed, hasSearched, results.length)

  return (
    <div>
      <StepHeading
        titleRef={headingRef}
        compact={claiming}
        eyebrow="Start here"
        title={claiming ? tClaim("find") : tUi("find_the_library_first")}
        lead={
          claiming
            ? tClaim("searchLead")
            : "If it’s already in the index, improve that record. If it isn’t, you can add it as a new library. It’s the same form either way."
        }
      />

      <div role="search" className="mt-6">
        <label
          htmlFor="index-query"
          id="index-query-label"
          className="mb-2 block text-base font-semibold"
        >
          Library name, town or city
        </label>
        <SearchField
          id="index-query"
          placeholder="e.g. Radlett, or Glasgow"
          label="Library name, town or city"
          loading={loading}
          onClear={() => handleQuery("")}
          inputProps={{
            value: query,
            onChange: (e) => handleQuery(e.target.value),
            autoComplete: "off",
            "aria-describedby": "index-status",
            "aria-labelledby": "index-query-label",
            maxLength: 120,
          }}
        />
      </div>
      <SearchResultsHeader
        claiming={claiming}
        hasSearched={hasSearched}
        loading={loading}
        failed={failed}
        status={status}
      />
      {failed && (
        <div role="alert" className="mb-5">
          <Notice
            icon="mdi:alert-circle-outline"
            tone="warn"
            title="We couldn’t search the index"
          >
            <p className="m-0">
              Your search is still here. Retry to check for an existing record.
            </p>
            <Button variant="surface" size="pill" onClick={handleRetry}>
              Try again
            </Button>
          </Notice>
        </div>
      )}
      {loading && (
        <div aria-hidden className="mb-4 grid gap-3">
          {[0, 1].map((n) => (
            <div
              key={n}
              className="h-24 rounded-[20px] bg-(--t-bg-surface) motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}

      <LibrarySearchResults
        results={results}
        claiming={claiming}
        onChooseLibrary={onChooseLibrary}
        hasSearched={hasSearched}
        loading={loading}
        failed={failed}
        needsHelp={needsHelp}
      />

      {/* Not listed? */}
      <div
        className={cn(
          "mt-6 flex flex-wrap items-center justify-between gap-4",
          claiming
            ? "border-t border-(--t-border-line) pt-5"
            : "rounded-[20px] border border-(--t-border-line) bg-(--t-bg-surface) p-5"
        )}
      >
        <div>
          <p
            className="m-0 text-base font-semibold"
            style={{ color: T.ink.base }}
          >
            Not listed?
          </p>
          <p className="m-0 mt-0.5 text-base" style={{ color: T.ink.dim }}>
            {canAdd
              ? "Searched and didn’t find it? Add it as a new library."
              : "Search first. Then you can add it if it’s missing."}
          </p>
        </div>
        <Link
          href={newLibraryHref ?? newHref(query)}
          aria-disabled={!canAdd}
          tabIndex={canAdd ? undefined : -1}
          onClick={(e) => {
            if (!canAdd) e.preventDefault()
          }}
          className={cn(
            buttonVariants({ variant: "primary", size: "pill" }),
            !canAdd && "pointer-events-none opacity-50"
          )}
          style={{
            border: "none",
            background: canAdd ? T.action.primary : T.bg.muted,
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
