"use client"
import type { MobileStop } from "@repo/shared-data"
import { useEffect, useState } from "react"

import { fieldInputStyle } from "@/components/library-editor/wizard.constants"
import { T } from "@/lib/design-tokens"
import type { Place } from "@/lib/geocode/place"

import { nearestStops } from "./mobile-helpers"

export function NearestStopFinder({
  stops,
  onSelect,
}: {
  readonly stops: MobileStop[]
  readonly onSelect: (id: string) => void
}) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
      null
    ),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    if (query.trim().length < 3) return () => controller.abort()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )
        if (!response.ok)
          throw new Error(
            "Place search is unavailable. You can still use your location or choose a stop below."
          )
        const data = (await response.json()) as { data: Place[] }
        setPlaces(data.data)
        setError("")
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Place search is unavailable."
          )
      }
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])
  const locate = () => {
    if (!navigator.geolocation) {
      setError(
        "This browser cannot find your location. Search for a place instead."
      )

      return
    }
    setBusy(true)
    setError("")
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setBusy(false)
      },
      () => {
        setError("Location was unavailable. Search for a place instead.")
        setBusy(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }
  const nearest = location ? nearestStops(stops, location) : []

  return (
    <section
      className="rounded-[20px] border p-5"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
      aria-labelledby="nearest-stop-heading"
    >
      <h3
        id="nearest-stop-heading"
        className="mt-0 mb-3 text-[20px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        Find your nearest stop
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 font-semibold hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {busy ? "Finding your location…" : "Use my location"}
        </button>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
          Or search for a place
          <input
            value={query}
            maxLength={200}
            onChange={(event) => {
              setQuery(event.target.value)
              setPlaces([])
            }}
            style={{ ...fieldInputStyle, fontWeight: 400 }}
            autoComplete="off"
          />
        </label>
      </div>
      <p className="text-sm" style={{ color: T.ink.dim }}>
        Your location stays in this browser. Distances are straight-line.
      </p>
      {error ? (
        <p role="alert" className="text-sm" style={{ color: T.accent.danger }}>
          {error}
        </p>
      ) : null}
      {places.length && query.length >= 3 ? (
        <ul className="list-none p-0">
          {places.map((place) => (
            <li key={place.id}>
              <button
                className="min-h-11 w-full py-2 text-left"
                type="button"
                onClick={() => {
                  setLocation({ lat: place.lat, lng: place.lng })
                  setPlaces([])
                  setQuery("")
                }}
              >
                {place.label} · {place.detail}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {location ? (
        <ul className="list-none p-0">
          {nearest.map(({ stop, km }) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => onSelect(stop.id)}
                className="min-h-11 py-2 text-left font-semibold"
                style={{ color: T.accent.primary }}
              >
                {stop.name} · {km.toFixed(1)} km →
              </button>
            </li>
          ))}
          {!nearest.length ? <li>Stops do not have map pins yet.</li> : null}
        </ul>
      ) : null}
    </section>
  )
}
