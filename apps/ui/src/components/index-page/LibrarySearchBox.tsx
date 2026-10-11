"use client"

import { Navigation, Search, X } from "lucide-react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { DEFAULT_FILTERS } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  type LibrarySearchHit,
  searchLibraries,
} from "@/lib/meilisearch"
import { Link, useRouter } from "@/lib/navigation"

/**
 * The library search pill shared by the homepage hero and Find libraries:
 * typing suggests libraries (pick one to open it), Enter or Search submits
 * the text, and Near me asks for the browser's location. What a submit or
 * Near me does is the caller's.
 */
export function LibrarySearchBox({
  id,
  defaultQuery = "",
  onSubmit,
  onClear,
  onNearMe,
  nearActive,
  locating = false,
  placeholder = "Search libraries, towns or countries",
  strong = false,
  className,
}: {
  readonly id: string
  readonly defaultQuery?: string
  /** The trimmed text, from Enter (no suggestion highlighted) or Search. */
  readonly onSubmit: (query: string) => void
  /** The box was emptied. */
  readonly onClear?: () => void
  readonly onNearMe: () => void
  /** Set when Near me toggles a filter, so it reads as pressed. */
  readonly nearActive?: boolean
  readonly locating?: boolean
  readonly placeholder?: string
  /** A 2px ink outline and no shadow: the homepage hero's version. */
  readonly strong?: boolean
  readonly className?: string
}) {
  const tUi = useUiTranslations("ui")

  const locale = useLocale()
  const router = useRouter()
  const listboxId = useId()
  const [query, setQuery] = useState(defaultQuery)
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [open, setOpen] = useState(false)
  // -1: nothing highlighted, so Enter submits the text.
  const [active, setActive] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typedRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // A prefilled query (from the URL) doesn't open suggestions on load.
    if (!query.trim() || !typedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([])
      setOpen(false)

      return
    }
    debounceRef.current = setTimeout(() => {
      searchLibraries({ ...DEFAULT_FILTERS, query }, { hitsPerPage: 6, locale })
        .then((res) => {
          setHits(res.hits)
          setActive(-1)
          setOpen(true)
        })
        .catch(() => setHits([]))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, locale])

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function submit() {
    setOpen(false)
    onSubmit(query.trim())
  }

  function pickHit(hit: LibrarySearchHit) {
    setOpen(false)
    const path = buildLibraryPath(hit)
    router.push(path ?? `/libraries?q=${encodeURIComponent(hit.name)}`)
  }

  function handleChange(value: string) {
    typedRef.current = true
    setQuery(value)
    if (!value.trim() && query.trim()) onClear?.()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && hits.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === "ArrowUp" && hits.length > 0) {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = open && active >= 0 ? hits[active] : undefined
      if (hit) pickHit(hit)
      else submit()
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const dropOpen = open && query.trim().length > 0
  const nearLabel = locating ? "Locating…" : nearActive ? "Near you" : "Near me"

  return (
    <div ref={containerRef} className={["relative", className].join(" ")}>
      <label htmlFor={id} className="sr-only">
        Search libraries by name, city, region or country
      </label>
      <div
        className={[
          "flex items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-5 transition-colors focus-within:border-(--t-accent-primary)",
          strong
            ? "border-2"
            : "border shadow-[0_8px_24px_rgba(23,22,43,0.08)]",
        ].join(" ")}
        style={{ borderColor: strong ? T.ink.base : T.border.hi }}
      >
        <Search
          aria-hidden="true"
          className="size-5 shrink-0"
          style={{ color: T.ink.dim }}
          strokeWidth={2}
        />
        <input
          id={id}
          role="combobox"
          aria-expanded={dropOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            dropOpen && active >= 0 && hits[active]
              ? `${listboxId}-opt-${active}`
              : undefined
          }
          autoComplete="off"
          className="w-0 min-w-0 flex-1 bg-transparent py-3 text-[17px] font-medium outline-none"
          style={{ color: T.ink.base }}
          placeholder={placeholder}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={onNearMe}
          aria-pressed={nearActive}
          className={[
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2.5 text-[15px] font-semibold whitespace-nowrap transition-colors sm:px-3.5",
            nearActive ? "" : "bg-white hover:bg-(--t-bg-muted)",
          ].join(" ")}
          style={
            nearActive
              ? {
                  background: T.ink.base,
                  borderColor: T.ink.base,
                  color: "#fff",
                }
              : { borderColor: T.border.hi, color: T.ink.base }
          }
        >
          <Navigation aria-hidden="true" className="size-3.5" />
          <span className="sr-only sm:not-sr-only">{nearLabel}</span>
          {nearActive && !locating ? (
            <X aria-hidden="true" className="hidden size-3.5 sm:block" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-full bg-(--t-accent-primary) px-5 py-3 text-[16px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) sm:px-6"
        >
          {tUi("search")}{" "}
        </button>
      </div>

      {dropOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={tUi("search_suggestions")}
          className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 rounded-2xl border bg-white p-2 shadow-[0_16px_40px_rgba(23,22,43,0.12)]"
          style={{ borderColor: T.border.line }}
        >
          {hits.map((hit, i) => {
            const location = [hit.city, hit.country_name]
              .filter(Boolean)
              .join(", ")

            return (
              <div
                key={hit.documentId}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={() => pickHit(hit)}
                onMouseEnter={() => setActive(i)}
                className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5"
                style={{
                  background: i === active ? T.accent.chip : "transparent",
                }}
              >
                <span
                  className="min-w-[54px] rounded-full px-2 py-0.5 text-center text-[13px] font-semibold"
                  style={{
                    background: "var(--tint-national-bg)",
                    color: "var(--tint-national-fg)",
                  }}
                >
                  {tUi("library")}{" "}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[16px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {hit.name}
                  </span>
                  {location ? (
                    <span
                      className="block truncate text-[14px]"
                      style={{ color: T.ink.dim }}
                    >
                      {location}
                    </span>
                  ) : null}
                </span>
              </div>
            )
          })}
          {hits.length === 0 ? (
            <div
              className="px-3 py-3.5 text-[15px]"
              style={{ color: T.ink.dim }}
            >
              Nothing matches &ldquo;{query}&rdquo; yet.{" "}
              <Link href="/contribute" style={{ color: T.accent.primary }}>
                Add a missing library
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
