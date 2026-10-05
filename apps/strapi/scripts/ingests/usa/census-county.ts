/**
 * The county and state at a point, from the US Census Bureau geocoder: its county
 * equivalents too, so a parish, borough, census area, planning region,
 * independent city, or a territory's municipio, island or district. US ingests
 * ask it when a dataset's own county name matches nothing in the atlas. The
 * state shows a point across a state line, as libraries in Texarkana and
 * Bristol are.
 *
 * Answers are cached in a JSON file, so a re-run asks once per point.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"

interface CountyResponse {
  result?: {
    geographies?: {
      Counties?: { NAME?: string }[]
      States?: { STUSAB?: string }[]
    }
  }
}

export interface PointPlace {
  county: string | null
  /** USPS code */
  state: string | null
}

export class CensusCounties {
  private readonly cache: Record<string, PointPlace>

  constructor(private readonly cachePath: string) {
    this.cache = existsSync(cachePath)
      ? JSON.parse(readFileSync(cachePath, "utf8"))
      : {}
  }

  async at(lat: number, lng: number): Promise<PointPlace> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key in this.cache) return this.cache[key]!

    const url = new URL(GEOCODER)
    url.search = new URLSearchParams({
      x: String(lng),
      y: String(lat),
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      layers: "Counties,States",
      format: "json",
    }).toString()

    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as CountyResponse
        const geo = body.result?.geographies
        const place = {
          county: geo?.Counties?.[0]?.NAME ?? null,
          state: geo?.States?.[0]?.STUSAB ?? null,
        }
        this.cache[key] = place
        this.save()

        return place
      } catch (err) {
        if (attempt >= 3) throw err
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
      }
    }
  }

  private save() {
    mkdirSync(path.dirname(this.cachePath), { recursive: true })
    writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1))
  }
}
