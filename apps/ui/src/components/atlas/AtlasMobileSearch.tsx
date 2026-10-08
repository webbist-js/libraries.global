"use client"
import { useLocale } from "next-intl"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { buildLibraryPath, type LibrarySearchHit } from "@/lib/meilisearch"
import {
  atlasMobileMultiSearch,
  type MobileStopHit,
} from "@/lib/mobile-stop-search"

export function AtlasMobileSearch({
  query,
  onPick,
}: {
  readonly query: string
  readonly onPick: (stop: MobileStopHit) => void
}) {
  const locale = useLocale(),
    [stops, setStops] = useState<MobileStopHit[]>([]),
    [libraries, setLibraries] = useState<LibrarySearchHit[]>([])
  useEffect(() => {
    if (query.trim().length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      atlasMobileMultiSearch(query.trim(), locale)
        .then((result) => {
          if (cancelled) return
          setLibraries((result.results[0]?.hits ?? []) as LibrarySearchHit[])
          setStops((result.results[1]?.hits ?? []) as MobileStopHit[])
        })
        .catch(() => {
          if (!cancelled) {
            setStops([])
            setLibraries([])
          }
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, locale])
  if (query.trim().length < 2 || (!stops.length && !libraries.length))
    return null

  return (
    <section
      className="mt-4 border-t pt-4"
      style={{ borderColor: T.border.line }}
      aria-label="Library and mobile stop search results"
    >
      <h3 className="text-sm font-bold">Libraries and stops</h3>
      <ul className="m-0 list-none p-0">
        {libraries.map((library) => {
          const path = buildLibraryPath(library)

          return path ? (
            <li key={library.documentId}>
              <GlobalLink
                className="flex min-h-11 items-center py-2 underline"
                href={path}
              >
                {library.name}
              </GlobalLink>
            </li>
          ) : null
        })}
        {stops.map((stop) => (
          <li key={stop.id}>
            <button
              type="button"
              className="min-h-11 w-full py-2 text-left"
              style={{ color: T.map.stopRing }}
              onClick={() => onPick(stop)}
            >
              <span aria-hidden="true">▢ </span>
              {stop.name}
              <span className="block text-sm" style={{ color: T.ink.dim }}>
                {stop.library_name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
