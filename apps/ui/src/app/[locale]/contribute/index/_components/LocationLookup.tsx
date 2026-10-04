"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { useEffect, useId, useState, useSyncExternalStore } from "react"

import { Notice } from "@/components/ds"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { findPlaces } from "@/lib/geocode/client"
import type { Place } from "@/lib/geocode/place"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "./wizard.constants"

const MIN_QUERY = 3
const DEBOUNCE_MS = 300
/** Beyond this many metres the device's position is only approximate. */
const APPROXIMATE_M = 200
/** GeolocationPositionError.PERMISSION_DENIED */
const PERMISSION_DENIED = 1

type Search = "idle" | "loading" | "done" | "error"
type GeoNote =
  | { kind: "located"; metres: number }
  | { kind: "refused" }
  | { kind: "failed" }

// Geolocation can't change while the page is open: nothing to subscribe to.
const subscribeNever = () => () => {}
const hasGeolocation = () => !!navigator.geolocation

const LINK = { color: T.accent.primary }

function StatusLine({
  tone,
  children,
}: {
  readonly tone: "ok" | "info"
  readonly children: string
}) {
  const { color, icon } =
    tone === "ok"
      ? { color: T.accent.ok, icon: "mdi:check-circle-outline" }
      : { color: T.ink.dim, icon: "mdi:information-outline" }

  return (
    <p
      role="status"
      className="m-0 flex items-start gap-1.5 text-[14px] leading-normal"
      style={{ color }}
    >
      <Icon
        aria-hidden="true"
        icon={icon}
        width={16}
        height={16}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </p>
  )
}

function Alert({
  title,
  children,
}: {
  readonly title: string
  readonly children: string
}) {
  return (
    <div role="status">
      <Notice icon="mdi:alert-circle-outline" tone="warn" title={title}>
        <p className="m-0" style={{ color: T.ink.base }}>
          {children}
        </p>
      </Notice>
    </div>
  )
}

function GeoStatus({ note }: { readonly note: GeoNote }) {
  if (note.kind === "refused")
    return (
      <Alert title="Location access is off">
        Search or drop a pin instead.
      </Alert>
    )
  if (note.kind === "failed")
    return (
      <Alert title="Couldn’t get your location">
        Search or drop a pin instead.
      </Alert>
    )
  if (note.metres > APPROXIMATE_M)
    return (
      <Alert title="Your location is approximate">
        {`Your device puts you within ${note.metres} m. Drag the pin onto the building.`}
      </Alert>
    )

  return (
    <StatusLine tone="ok">{`Pin placed where you are, to within ${note.metres} m.`}</StatusLine>
  )
}

/**
 * Step 2's search: a combobox over OpenStreetMap places (through
 * /api/geocode/search) and a "Use my location" button.
 */
export function LocationLookup({
  initialQuery,
  onPick,
  onLocate,
}: {
  /** What the search box starts with: the library's name, in new mode. */
  readonly initialQuery: string
  /** A result was chosen. */
  readonly onPick: (place: Place) => void
  /** The device reported where it is. */
  readonly onLocate: (lat: number, lng: number) => void
}) {
  const id = useId()
  const inputId = `${id}-input`
  const listId = `${id}-list`
  const hintId = `${id}-hint`
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Place[]>([])
  const [search, setSearch] = useState<Search>("idle")
  const [active, setActive] = useState(-1)
  const [picked, setPicked] = useState(false)
  const [locating, setLocating] = useState(false)
  const [geo, setGeo] = useState<GeoNote | null>(null)
  const canLocate = useSyncExternalStore(
    subscribeNever,
    hasGeolocation,
    () => false
  )

  const q = query.trim()
  const typedEnough = q.length >= MIN_QUERY

  useEffect(() => {
    if (!open || !typedEnough) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearch("loading")
      findPlaces(q, controller.signal)
        .then((places) => {
          setResults(places)
          setActive(-1)
          setSearch("done")
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearch("error")
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, open, typedEnough])

  const showList = open && typedEnough && results.length > 0
  const noMatches =
    open && typedEnough && search === "done" && results.length === 0
  const found =
    results.length === 1 ? "1 place found" : `${results.length} places found`

  const choose = (place: Place) => {
    onPick(place)
    setQuery(place.label)
    setOpen(false)
    setActive(-1)
    setPicked(true)
  }

  const move = (step: 1 | -1) => {
    if (results.length === 0) return
    setActive((i) => {
      if (i < 0) return step === 1 ? 0 : results.length - 1

      return (i + step + results.length) % results.length
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      move(e.key === "ArrowDown" ? 1 : -1)

      return
    }
    if (e.key === "Enter" && showList) {
      const place = results[active]
      if (place) {
        e.preventDefault()
        choose(place)
      }

      return
    }
    if (e.key === "Escape" && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  const locate = () => {
    setLocating(true)
    setGeo(null)
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setGeo({ kind: "located", metres: Math.round(coords.accuracy) })
        onLocate(coords.latitude, coords.longitude)
      },
      (error) => {
        setLocating(false)
        setGeo({
          kind: error.code === PERMISSION_DENIED ? "refused" : "failed",
        })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={inputId} style={fieldLabelStyle}>
        Find the library or its address
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            height={20}
            icon="mdi:magnify"
            style={{
              color: search === "loading" ? T.accent.primary : T.ink.dim,
            }}
            width={20}
          />
          <input
            aria-activedescendant={
              showList && active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-describedby={hintId}
            aria-expanded={showList}
            autoComplete="off"
            id={inputId}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setPicked(false)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="e.g. British Library, or 96 Euston Road, London"
            role="combobox"
            spellCheck={false}
            style={{ ...fieldInputStyle, paddingLeft: "46px" }}
            type="text"
            value={query}
          />
          <ul
            aria-label="Places"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 max-h-[340px] list-none overflow-y-auto rounded-[14px] border bg-white p-1.5"
            hidden={!showList}
            id={listId}
            role="listbox"
            style={{
              borderColor: T.border.hi,
              boxShadow: "0 12px 28px rgba(23,22,43,.08)",
            }}
          >
            {results.map((place, i) => (
              <li
                key={place.id}
                aria-selected={i === active}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-[10px] px-3 py-2.5 hover:bg-(--t-bg-surface) aria-selected:bg-(--t-accent-chip)"
                id={`${listId}-${i}`}
                onClick={() => choose(place)}
                onMouseDown={(e) => e.preventDefault()}
                role="option"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {place.label}
                  </span>
                  {place.detail ? (
                    <span
                      className="text-[13.5px] leading-snug"
                      style={{ color: T.ink.dim }}
                    >
                      {place.detail}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-semibold"
                  style={{
                    background: TYPE_TINT.neutral.bg,
                    color: TYPE_TINT.neutral.fg,
                  }}
                >
                  {place.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {canLocate ? (
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-wait disabled:opacity-70"
            style={{
              border: `1px solid ${T.border.hi}`,
              background: T.bg.deep,
              color: T.ink.base,
              fontFamily: T.font.sans,
            }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:crosshairs-gps"
              width={18}
              height={18}
            />
            {locating ? "Finding you…" : "Use my location"}
          </button>
        ) : null}
      </div>
      <p id={hintId} style={fieldHintStyle}>
        Pick a result to fill in the address and drop the pin. Search by{" "}
        <a
          href="https://photon.komoot.io"
          target="_blank"
          rel="noopener noreferrer"
          style={LINK}
        >
          Photon
        </a>
        , map data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          style={LINK}
        >
          OpenStreetMap contributors
        </a>
        .
      </p>
      <p aria-live="polite" className="sr-only">
        {showList ? `${found}. Use the arrow keys to choose.` : ""}
      </p>
      {picked ? (
        <StatusLine tone="ok">
          Filled in from OpenStreetMap. Check the details below.
        </StatusLine>
      ) : null}
      {noMatches ? (
        <StatusLine tone="info">
          No matches. Try the street and town, or enter the address below.
        </StatusLine>
      ) : null}
      {search === "error" ? (
        <Alert title="Search isn’t available right now">
          Enter the address below.
        </Alert>
      ) : null}
      {geo ? <GeoStatus note={geo} /> : null}
    </div>
  )
}
