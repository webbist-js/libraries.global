"use client"
import { useEffect, useState } from "react"

import { Card } from "@/components/ds"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import {
  searchNearbyMobileStops,
  type MobileStopHit,
} from "@/lib/mobile-stop-search"
import { Link } from "@/lib/navigation"

import { nearestMobileLibraries } from "./mobile-place-stops.logic"
import { MobileStopSummary } from "./MobilePlaceStops"

export function NearbyMobileLibraries({
  lat,
  lng,
  radiusKm,
  onStops,
}: {
  lat: number
  lng: number
  radiusKm: number
  onStops?: (hits: MobileStopHit[]) => void
}) {
  const [hits, setHits] = useState<MobileStopHit[]>([]),
    [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    searchNearbyMobileStops({
      lat,
      lng,
      radius: (radiusKm > 0 ? radiusKm : 50) * 1000,
      limit: 1000,
    })
      .then((value) => {
        if (!active) return
        setError(false)
        setHits(nearestMobileLibraries(value))
        onStops?.(value)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [lat, lng, radiusKm, onStops])
  if (!hits.length && !error) return null

  return (
    <section
      className="mb-6 rounded-[20px] border p-5"
      aria-label="Mobile libraries near you"
      style={{ borderColor: T.edge.ok, background: TYPE_TINT.public.bg }}
    >
      <h2
        className="mt-0 mb-3 text-[22px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        Mobile libraries that stop near you
      </h2>
      {error ? (
        <p role="status">Nearby mobile stops are temporarily unavailable.</p>
      ) : (
        <ul className="m-0 list-none space-y-4 p-0">
          {hits.map((hit) => (
            <li key={hit.library_document_id}>
              <Card className="p-4">
                {hit.library_path ? (
                  <Link className="font-semibold" href={hit.library_path}>
                    {hit.library_name} →
                  </Link>
                ) : (
                  <strong>{hit.library_name}</strong>
                )}
                <p className="my-1 text-sm" style={{ color: T.ink.dim }}>
                  Nearest stop
                  {hit._geoDistance != null
                    ? ` · ${(hit._geoDistance / 1000).toFixed(1)} km`
                    : ""}
                </p>
                <MobileStopSummary hit={hit} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
