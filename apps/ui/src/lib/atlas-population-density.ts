import "server-only"

import { createHash } from "node:crypto"

import {
  atlasLocalGeography,
  atlasPopulationBaseline,
  atlasPopulationDensity,
  POPULATION_REFERENCE_YEAR,
  type AtlasPopulationDensityArea,
  type AtlasPopulationDensityResponse,
  type AtlasPopulationLevel,
  type PopulationObservation,
} from "@repo/shared-data"
import { atlasPopulationGeography as geography } from "@repo/shared-data/atlas-population"

import type { AtlasBackend } from "./atlas-backend"
import type { AtlasContextRelease } from "./atlas-context"

/** Density is independent of indexed-library counts and library filters. */
export async function queryPopulationDensity(
  backend: AtlasBackend,
  level: AtlasPopulationLevel,
  country = "GB"
): Promise<AtlasPopulationDensityResponse> {
  if (level !== "countries" && country !== "GB")
    return countryDensity(backend, level, country)
  const local = level !== "countries"
  const [catalogue, state, newer] = await Promise.all([
    backend.bridge(
      local ? "/api/atlas/population/local" : "/api/atlas/countries"
    ),
    local ? Promise.resolve(null) : backend.state().catch(() => null),
    local
      ? Promise.resolve(null)
      : backend
          .bridge("/api/atlas/population/context?country=all")
          .catch(() => null),
  ])
  const observations = populationObservations(catalogue.observations)
  applyNewerObservations(observations, newer)
  if (
    geography.localBoundaryVersion !== atlasLocalGeography.version ||
    geography.countryBoundaryVersion !== atlasPopulationBaseline.version ||
    (local && catalogue.geography?.version !== atlasLocalGeography.version)
  )
    throw new Error("Population boundary versions disagree")

  let areas: AtlasPopulationDensityArea[]
  if (level === "countries") {
    const sizes = geography.countryAreas as Record<string, number>
    areas = atlasPopulationBaseline.countries.map((area) =>
      areaRow(
        area.iso3,
        area.name,
        sizes[area.iso3] ?? null,
        area.bounds,
        observations.get(area.iso3)
      )
    )
  } else if (level === "local") {
    const sizes = geography.localAreas as Record<string, number>
    areas = atlasLocalGeography.areas.map((area) =>
      areaRow(
        area.code,
        area.name,
        sizes[area.code] ?? null,
        area.bounds,
        observations.get(area.code)
      )
    )
  } else {
    areas = geography.regions.map((region) => {
      const rows = region.members.map((code) => observations.get(code))
      const complete =
        rows.every((row) => row?.population !== null && row !== undefined) &&
        new Set(rows.map((row) => row?.year)).size === 1
      const observation = complete
        ? {
            ...rows[0]!,
            population: rows.reduce((sum, row) => sum + row!.population!, 0),
          }
        : undefined

      return areaRow(
        region.id,
        region.name,
        region.areaKm2,
        region.bounds,
        observation
      )
    })
  }
  const countryTiles = state?.manifest?.countryTiles

  return {
    schemaVersion: 1,
    level,
    populationVersion: createHash("sha256")
      .update(JSON.stringify([catalogue.observations, newer?.observations]))
      .digest("hex")
      .slice(0, 16),
    boundaryVersion: geography.version,
    areas,
    geometry:
      level === "countries"
        ? countryTiles?.version === atlasPopulationBaseline.version
          ? {
              type: "pmtiles",
              url: countryTiles.url,
              property: "iso3",
              sourceLayer: "countries",
            }
          : {
              type: "geojson",
              url: atlasPopulationBaseline.geometryUrl,
              property: "iso3",
            }
        : {
            type: "geojson",
            url:
              level === "regions"
                ? geography.regionGeometryUrl
                : atlasLocalGeography.geometryUrl,
            property: "code",
          },
    areaMethod: geography.areaMethod,
    note: "Residents per km² of the whole reporting boundary, including inland waters. Population is independent of library filters. Countries worldwide, UK districts, and English county groups are supported. County groups follow the directory's whole-district membership and can differ from ceremonial counties. This is an administrative-area average, not a fine-grained population surface.",
  }
}

async function countryDensity(
  backend: AtlasBackend,
  level: AtlasPopulationLevel,
  country: string
): Promise<AtlasPopulationDensityResponse> {
  if (!["SE", "NO", "DK", "FI", "AX"].includes(country))
    throw new Error("Unsupported population geography")
  const [catalogue, context] = await Promise.all([
    backend.bridge(`/api/atlas/population/context?country=${country}`),
    backend.bridge("/api/atlas/context?kind=catalogue"),
  ])
  const release = (context.releases as AtlasContextRelease[] | undefined)?.find(
    (r) =>
      r.theme === "administrative" && r.country === country && r.level === level
  )
  if (!release || !/^[a-z0-9-]{1,100}$/.test(release.id))
    throw new Error("Population boundaries unavailable")
  const features = await backend.bridge(
    `/api/atlas/context?kind=geometry&release=${release.id}`
  )
  if (
    !Array.isArray(features.features) ||
    features.features.length > 1024 ||
    !Array.isArray(catalogue.observations) ||
    catalogue.observations.length > 4096
  )
    throw new Error("Population context exceeds budget")
  const observations = new Map<
    string,
    PopulationObservation & { boundaryVersion: string }
  >()
  for (const row of catalogue.observations) {
    if (row.level !== (level === "local" ? "area" : "region")) continue
    if (
      observations.has(row.reportingCode) ||
      !Number.isInteger(row.year) ||
      row.year < 1900 ||
      row.year > 2100 ||
      row.boundaryVersion.replace(/^statfin-/, "") !== release.boundaryDate ||
      (row.population !== null &&
        (!Number.isSafeInteger(row.population) || row.population < 0))
    )
      throw new Error("Population boundary vintage disagrees")
    observations.set(row.reportingCode, row)
  }
  const areas = (
    features.features as {
      properties: {
        code: string
        name: string
        bounds: AtlasPopulationDensityArea["bounds"]
        areaKm2: number
      }
    }[]
  ).map((feature) => {
    const p = feature.properties
    const row = observations.get(p.code)

    return {
      id: p.code,
      name: row?.name ?? p.name,
      bounds: p.bounds,
      areaKm2: p.areaKm2,
      population: row?.population ?? null,
      peoplePerKm2: atlasPopulationDensity(row?.population ?? null, p.areaKm2),
      year: row?.year ?? release.year,
      source: row?.source ?? "",
      sourceUrl: row?.sourceUrl ?? "",
      licence: row?.licence ?? "",
    }
  })

  return {
    schemaVersion: 1,
    level,
    populationVersion: createHash("sha256")
      .update(JSON.stringify(catalogue.observations))
      .digest("hex")
      .slice(0, 16),
    boundaryVersion: release.id,
    geometry: {
      type: "geojson",
      url: `/api/atlas/context?kind=geometry&release=${release.id}`,
      property: "code",
    },
    areas,
    areaMethod: release.note,
    note: `${release.edition}. ${release.note}`,
  }
}

function populationObservations(input: unknown) {
  if (!Array.isArray(input) || input.length > 1024)
    throw new Error("Population catalogue exceeds budget")
  const observations = new Map<string, PopulationObservation>()
  for (const row of input as PopulationObservation[]) {
    if (
      observations.has(row.reportingCode) ||
      row.year !== POPULATION_REFERENCE_YEAR ||
      (row.population !== null &&
        (!Number.isSafeInteger(row.population) || row.population < 0))
    )
      throw new Error("Invalid population catalogue")
    observations.set(row.reportingCode, row)
  }

  return observations
}

const areaRow = (
  id: string,
  name: string,
  areaKm2: number | null,
  bounds: AtlasPopulationDensityArea["bounds"],
  row: PopulationObservation | undefined
): AtlasPopulationDensityArea => ({
  id,
  name:
    (row as (PopulationObservation & { name?: string }) | undefined)?.name ??
    name,
  areaKm2,
  bounds,
  population: row?.population ?? null,
  peoplePerKm2: atlasPopulationDensity(row?.population ?? null, areaKm2),
  year: row?.year ?? POPULATION_REFERENCE_YEAR,
  source: row?.source ?? "",
  sourceUrl: row?.sourceUrl ?? "",
  licence: row?.licence ?? "",
})

function applyNewerObservations(
  observations: Map<string, PopulationObservation>,
  newer: { observations?: PopulationObservation[] } | null
) {
  if (
    newer &&
    Array.isArray(newer.observations) &&
    newer.observations.length <= 6
  ) {
    for (const row of newer.observations as PopulationObservation[]) {
      if (
        !["SWE", "NOR", "DNK", "FIN", "ALA"].includes(row.reportingCode) ||
        !Number.isInteger(row.year) ||
        row.year < 2024 ||
        row.year > 2100 ||
        (row.population !== null &&
          (!Number.isSafeInteger(row.population) || row.population < 0))
      )
        throw new Error("Invalid latest population catalogue")
      observations.set(row.reportingCode, row)
    }
  }
}
