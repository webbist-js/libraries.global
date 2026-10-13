"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { type KeyboardEvent, useEffect, useId, useState } from "react"

import { SearchField } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { PlaceOption } from "@/lib/drives/place-search"

import type { BuilderPlace } from "./builder.logic"

/** Wait this long after the last key before asking for places. */
const SEARCH_DEBOUNCE_MS = 250

/** Shorter queries match too much to be useful. */
const MIN_QUERY = 2

export const LEVEL_WORD: Record<BuilderPlace["level"], string> = {
  continent: "Continent",
  country: "Country",
  region: "Region",
  area: "Area",
}

type Results =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; places: PlaceOption[] }
  | { status: "error"; query: string }

/**
 * "Add a continent, country, county or area": a search field that offers
 * matching places from `/api/drives/places` in a listbox (a combobox:
 * arrow keys move, Enter adds, Escape closes). Choosing one adds it with
 * `onAdd`; places already chosen aren't offered again.
 */
export function PlaceSearch({
  id,
  locale,
  chosen,
  invalid,
  describedBy,
  onAdd,
}: {
  /** The input's id: the error summary's link focuses it. */
  readonly id: string
  readonly locale: string
  readonly chosen: readonly BuilderPlace[]
  readonly invalid: boolean
  readonly describedBy?: string
  readonly onAdd: (place: BuilderPlace) => void
}) {
  const tUi = useUiTranslations("ui")

  const listId = useId()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Results>({ status: "idle" })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const q = query.trim()

  useEffect(() => {
    if (q.length < MIN_QUERY) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, locale })
        const res = await fetch(`/api/drives/places?${params.toString()}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { data?: PlaceOption[] }
        setResults({ status: "ready", query: q, places: json.data ?? [] })
        setActive(-1)
      } catch {
        if (!ctrl.signal.aborted) setResults({ status: "error", query: q })
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, locale])

  const options =
    results.status === "ready" && results.query === q
      ? results.places.filter(
          (p) => !chosen.some((c) => c.level === p.level && c.slug === p.slug)
        )
      : []
  const showPanel = open && q.length >= MIN_QUERY
  const showList = showPanel && options.length > 0
  const optionId = (i: number) => `${listId}-option-${i}`

  const type = (value: string) => {
    setQuery(value)
    setOpen(true)
    setActive(-1)
    setResults(
      value.trim().length >= MIN_QUERY
        ? { status: "loading", query: value.trim() }
        : { status: "idle" }
    )
  }

  const choose = (place: PlaceOption) => {
    onAdd({
      level: place.level,
      slug: place.slug,
      name: place.name,
      ...(place.kind ? { kind: place.kind } : {}),
    })
    setQuery("")
    setResults({ status: "idle" })
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setOpen(true)
        if (options.length > 0) setActive((a) => (a + 1) % options.length)
        break
      case "ArrowUp":
        e.preventDefault()
        if (options.length > 0) {
          setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
        }
        break
      case "Enter": {
        // Enter in this field never sends the form.
        e.preventDefault()
        const place = options[active] ?? (showList ? options[0] : undefined)
        if (place) choose(place)
        break
      }
      case "Escape":
        if (showPanel) {
          e.preventDefault()
          setOpen(false)
          setActive(-1)
        }
        break

      default:
        break
    }
  }

  let status: string | null = null
  if (showPanel && !showList) {
    if (results.status === "error") {
      status = "Places couldn’t be loaded. Try again in a moment."
    } else if (results.status === "ready" && results.query === q) {
      status =
        results.places.length > 0
          ? `Every place matching “${q}” is already added.`
          : `No places match “${q}”.`
    } else {
      status = "Searching…"
    }
  }

  return (
    <div className="relative">
      <SearchField
        id={id}
        placeholder="Add a continent, country, county or area"
        label={tUi("add_a_place")}
        className={invalid ? "border-(--t-accent-danger)" : undefined}
        loading={results.status === "loading"}
        onClear={() => type("")}
        inputProps={{
          value: query,
          role: "combobox",
          autoComplete: "off",
          spellCheck: false,
          "aria-expanded": showList,
          "aria-controls": listId,
          "aria-autocomplete": "list",
          "aria-activedescendant":
            showList && active >= 0 ? optionId(active) : undefined,
          "aria-invalid": invalid || undefined,
          "aria-describedby": describedBy,
          onChange: (e) => type(e.target.value),
          onKeyDown,
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
        }}
      />
      <div
        className="absolute top-[calc(100%+8px)] right-0 left-0 z-20 overflow-hidden rounded-[16px]"
        style={{
          display: showPanel ? "block" : "none",
          background: T.bg.deep,
          border: `1px solid ${T.border.hi}`,
          boxShadow: "0 12px 28px rgba(23,22,43,.08)",
        }}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={tUi("places")}
          className="m-0 max-h-[320px] list-none overflow-y-auto p-1.5"
          style={{ display: showList ? "block" : "none" }}
        >
          {options.map((p, i) => (
            <li
              key={`${p.level}:${p.slug}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
              className="flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5"
              style={{
                background: i === active ? T.accent.chip : "transparent",
              }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:map-marker-outline"
                width={18}
                height={18}
                className="shrink-0"
                style={{ color: T.accent.primary }}
              />
              <span className="flex min-w-0 flex-col">
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {p.name}
                </span>
                <span className="text-[13px]" style={{ color: T.ink.dim }}>
                  {p.kind ?? LEVEL_WORD[p.level]}
                  {p.context ? ` · ${p.context}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {status ? (
          <p
            role="status"
            className="m-0 px-4 py-3 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  )
}
