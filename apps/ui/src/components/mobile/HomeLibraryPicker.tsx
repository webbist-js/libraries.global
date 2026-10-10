"use client"
import { useEffect, useId, useState } from "react"

import { fieldInputStyle } from "@/components/library-editor/wizard.constants"
import { T } from "@/lib/design-tokens"

export type HomeLibraryHit = {
  documentId: string
  name: string
  city?: string | null
  libraryType?: string | null
  streetAddress?: string | null
  postalCode?: string | null
  location?: { lat: number; lng: number } | null
  continent?: { documentId: string } | null
  country?: { documentId: string; name: string } | null
  region?: { documentId: string } | null
  area?: { documentId: string } | null
}
type Hit = HomeLibraryHit

export function HomeLibraryPicker({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (id: string, home?: HomeLibraryHit) => void
}) {
  const [query, setQuery] = useState(""),
    [hits, setHits] = useState<Hit[]>([]),
    [selected, setSelected] = useState<Hit | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const id = useId()
  useEffect(() => {
    if (query.trim().length < 2) return
    const abort = new AbortController()
    const timeout = setTimeout(async () => {
      setBusy(true)
      try {
        const result = await fetch(
          `/api/search/libraries?q=${encodeURIComponent(query.trim())}`,
          { signal: abort.signal }
        )
        if (!result.ok) throw new Error("search_failed")
        const body = await result.json()
        setHits(
          (body.data ?? []).filter(
            (hit: Hit) => hit.libraryType !== "Mobile" && hit.documentId
          )
        )
        setError("")
      } catch {
        if (!abort.signal.aborted)
          setError(
            "Library search is unavailable right now. Add the depot address below instead."
          )
      } finally {
        if (!abort.signal.aborted) setBusy(false)
      }
    }, 250)

    return () => {
      clearTimeout(timeout)
      abort.abort()
    }
  }, [query])

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-semibold">
        Based at (optional)
      </label>
      {value ? (
        <div
          className="flex items-center gap-3 rounded-[14px] border p-3"
          style={{ borderColor: T.border.line, background: T.bg.surface }}
        >
          <span>
            {selected?.name ?? "Home library selected"}
            {selected?.city ? ` · ${selected.city}` : ""}
          </span>
          <button
            type="button"
            className="min-h-11 px-3 font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
            onClick={() => {
              onChange("")
              setSelected(null)
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            autoComplete="off"
            style={fieldInputStyle}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHits([])
            }}
            placeholder="Find the branch where this vehicle is based"
          />
          <ul className="m-0 list-none p-0">
            {query.trim().length >= 2 &&
              hits.map((hit) => (
                <li key={hit.documentId}>
                  <button
                    type="button"
                    className="min-h-11 w-full p-3 text-left hover:bg-(--t-bg-selected)"
                    onClick={() => {
                      setSelected(hit)
                      onChange(hit.documentId, hit)
                      setQuery("")
                      setHits([])
                    }}
                  >
                    {hit.name}
                    {hit.city ? ` · ${hit.city}` : ""}
                  </button>
                </li>
              ))}
          </ul>
          {busy && (
            <p
              role="status"
              className="m-0 text-sm"
              style={{ color: T.ink.dim }}
            >
              Searching…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="m-0 text-sm"
              style={{ color: T.accent.danger }}
            >
              {error}
            </p>
          )}
        </>
      )}
      <p className="text-sm" style={{ color: T.ink.dim }}>
        The selected branch supplies the home base address and location. Without
        a branch, add the depot address below.
      </p>
    </div>
  )
}
