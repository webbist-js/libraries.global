"use client"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { buildLibraryPath, type LibrarySearchHit } from "@/lib/meilisearch"
import {
  atlasMobileMultiSearch,
  type MobileStopHit,
} from "@/lib/mobile-stop-search"

import { Icon } from "./atlas-ui"
import { ResultGroup, ResultRow } from "./AtlasSearchResults"

export type MobileSearchStatus = {
  query: string
  count: number
  pending: boolean
  failed?: boolean
}

export function AtlasMobileSearch({
  query,
  onPick,
  onStatus,
  libraryIds,
}: {
  readonly query: string
  readonly onPick: (stop: MobileStopHit) => void
  readonly onStatus: (status: MobileSearchStatus) => void
  readonly libraryIds: Set<string>
}) {
  const tUi = useUiTranslations("ui")

  const locale = useLocale()
  const term = query.trim()
  const [loaded, setLoaded] = useState<{
    query: string
    stops: MobileStopHit[]
    libraries: LibrarySearchHit[]
  } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (term.length < 2) return
    let cancelled = false
    onStatus({ query: term, count: 0, pending: true })
    const timer = setTimeout(() => {
      atlasMobileMultiSearch(term, locale)
        .then((result) => {
          if (cancelled) return
          const stops = (result.results[1]?.hits ?? []) as MobileStopHit[]
          const libraries = (result.results[0]?.hits ??
            []) as LibrarySearchHit[]
          setLoaded({ query: term, stops, libraries })
          setFailed(null)
          onStatus({
            query: term,
            count:
              stops.length +
              libraries.filter((library) => buildLibraryPath(library)).length,
            pending: false,
          })
        })
        .catch(() => {
          if (cancelled) return
          setFailed(term)
          onStatus({ query: term, count: 0, pending: false, failed: true })
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, locale, onStatus])
  if (term.length < 2) return null
  if (failed === term)
    return (
      <p role="status" className="m-0 text-sm" style={{ color: T.ink.dim }}>
        Mobile stop search is unavailable. Try again shortly.
      </p>
    )
  if (loaded?.query !== term)
    return (
      <p role="status" className="m-0 text-sm" style={{ color: T.ink.dim }}>
        Searching libraries and stops…
      </p>
    )
  const libraries = loaded.libraries.filter(
    (library) =>
      !libraryIds.has(library.documentId) && buildLibraryPath(library)
  )

  return (
    <>
      {loaded.stops.length ? (
        <ResultGroup title={tUi("mobile_library_stops")}>
          {loaded.stops.map((stop) => (
            <ResultRow
              key={stop.id}
              icon="bus"
              title={stop.name}
              sub={[stop.where, stop.library_name].filter(Boolean).join(" · ")}
              onClick={() => onPick(stop)}
            />
          ))}
        </ResultGroup>
      ) : null}
      {libraries.length ? (
        <ResultGroup title={tUi("more_libraries")}>
          {libraries.map((library) => (
            <li key={library.documentId}>
              <GlobalLink
                href={buildLibraryPath(library)}
                className="flex min-h-14 items-center gap-3 rounded-xl py-2 hover:bg-(--t-bg-surface)"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-lg border-2"
                  style={{ color: T.map.stopRing, borderColor: T.map.stopRing }}
                >
                  <Icon
                    name={library.libraryType === "Mobile" ? "bus" : "book"}
                    size={18}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {library.name}
                  </span>
                  <span
                    className="block text-[13px]"
                    style={{ color: T.ink.dim }}
                  >
                    {library.libraryType === "Mobile"
                      ? "Mobile library"
                      : tUi("library")}
                  </span>
                </span>
              </GlobalLink>
            </li>
          ))}
        </ResultGroup>
      ) : null}
    </>
  )
}
