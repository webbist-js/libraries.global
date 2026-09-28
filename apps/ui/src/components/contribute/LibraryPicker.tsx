"use client"

import { Icon } from "@iconify/react"
import { useEffect, useId, useState } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import type { WizardLibrary } from "./wizard.logic"

export type LibrarySuggestion = WizardLibrary & { missing: string[] }

type SearchHit = { slug: string; name: string; city?: string | null }

function useDebounced<V>(value: V, delay: number): V {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/** Step 1: search the index (a combobox), or pick a record that needs help. */
export function LibraryPicker({
  selected,
  onSelect,
  publishedCount,
  suggestions = [],
}: {
  readonly selected: WizardLibrary | null
  readonly onSelect: (library: WizardLibrary | null) => void
  readonly publishedCount?: number
  readonly suggestions?: readonly LibrarySuggestion[]
}) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounced(query.trim(), 250)
  const open = debounced.length >= 2 && !selected

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request state
    setSearching(true)
    fetch(`/api/search/libraries?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((json: { data?: SearchHit[] }) => {
        if (!cancelled) {
          setHits((json.data ?? []).slice(0, 6))
          setActive(-1)
        }
      })
      .catch(() => {
        if (!cancelled) setHits([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debounced, open])

  const choose = (hit: SearchHit) => {
    onSelect({
      slug: hit.slug,
      name: hit.name,
      ...(hit.city ? { place: hit.city } : {}),
    })
    setQuery("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % hits.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1))
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      choose(hits[active]!)
    } else if (e.key === "Escape") {
      setQuery("")
    }
  }

  const listId = `${id}-list`
  const inputId = `${id}-input`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="m-0 text-[20px] font-bold" style={{ color: T.ink.base }}>
          Which library is this about?
        </h3>
        {publishedCount ? (
          <p className="mt-1 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
            Search the {publishedCount.toLocaleString("en-GB")} published
            records.
          </p>
        ) : null}
      </div>

      {selected ? (
        <div
          className="flex max-w-[640px] items-center justify-between gap-3 rounded-[14px] border-2 px-4 py-3"
          style={{ background: T.accent.chip, borderColor: T.accent.primary }}
        >
          <span className="flex items-center gap-2.5">
            <Icon
              aria-hidden="true"
              height={20}
              icon="mdi:check-circle"
              style={{ color: T.accent.primary }}
              width={20}
            />
            <span>
              <span
                className="block text-[16px] font-semibold"
                style={{ color: T.ink.base }}
              >
                {selected.name}
              </span>
              {selected.place ? (
                <span
                  className="block text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  {selected.place}
                </span>
              ) : null}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-full border bg-white px-3 py-1.5 text-[14px] font-semibold"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative max-w-[640px]">
          <label
            className="mb-2 block text-[15px] font-semibold"
            htmlFor={inputId}
            style={{ color: T.ink.base }}
          >
            Library name or place
          </label>
          <div className="relative">
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
              height={20}
              icon="mdi:magnify"
              style={{ color: searching ? T.accent.primary : T.ink.dim }}
              width={20}
            />
            <input
              aria-activedescendant={
                open && active >= 0 ? `${listId}-${active}` : undefined
              }
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open}
              autoComplete="off"
              className="h-14 w-full rounded-[14px] border border-(--t-border-hi) bg-white pr-4 pl-12 text-[16px] transition-colors outline-none placeholder:text-(--t-ink-faint) focus:border-(--t-accent-primary)"
              id={inputId}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. Epworth"
              role="combobox"
              style={{ color: T.ink.base }}
              type="text"
              value={query}
            />
          </div>
          {open ? (
            <ul
              className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 list-none rounded-[14px] border bg-white p-1.5"
              id={listId}
              role="listbox"
              style={{
                borderColor: T.border.hi,
                boxShadow: "0 12px 28px rgba(23,22,43,.08)",
              }}
            >
              {searching && hits.length === 0 ? (
                <li
                  className="px-3 py-2.5 text-[14px]"
                  style={{ color: T.ink.low }}
                >
                  Searching…
                </li>
              ) : hits.length === 0 ? (
                <li
                  className="px-3 py-2.5 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  No records match. Try another spelling, or{" "}
                  <Link
                    href="/contribute/add"
                    style={{ color: T.accent.primary }}
                  >
                    add it as a new library
                  </Link>
                  .
                </li>
              ) : (
                hits.map((hit, i) => (
                  <li
                    key={hit.slug}
                    aria-selected={i === active}
                    className="cursor-pointer rounded-[10px] px-3 py-2.5 text-[15px] hover:bg-(--t-bg-surface) aria-selected:bg-(--t-accent-chip)"
                    id={`${listId}-${i}`}
                    onClick={() => choose(hit)}
                    onMouseDown={(e) => e.preventDefault()}
                    role="option"
                    style={{ color: T.ink.base }}
                  >
                    <span className="font-semibold">{hit.name}</span>
                    {hit.city ? (
                      <span style={{ color: T.ink.dim }}> · {hit.city}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}

      {!selected && suggestions.length > 0 ? (
        <div>
          <p
            className="m-0 mb-3 text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            Records with missing details
          </p>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((s) => (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect({ slug: s.slug, name: s.name, place: s.place })
                  }
                  className="flex h-full w-full flex-col items-start gap-1 rounded-[16px] border p-4 text-left transition-colors hover:border-(--t-accent-primary)"
                  style={{
                    background: T.bg.surface,
                    borderColor: T.border.line,
                  }}
                >
                  <span
                    className="text-[16px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {s.name}
                  </span>
                  {s.place ? (
                    <span className="text-[14px]" style={{ color: T.ink.dim }}>
                      {s.place}
                    </span>
                  ) : null}
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {s.missing.map((m) => (
                      <span
                        key={m}
                        className="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
                        style={{
                          background: "var(--tint-special-bg)",
                          color: "var(--tint-special-fg)",
                        }}
                      >
                        No {m.toLowerCase()}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
