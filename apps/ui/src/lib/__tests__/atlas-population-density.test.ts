import { atlasLocalGeography } from "@repo/shared-data"
import { atlasPopulationGeography } from "@repo/shared-data/atlas-population"
import { expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import type { AtlasBackend } from "../atlas-backend"
import { queryPopulationDensity } from "../atlas-population-density"

it("aggregates complete same-year district controls and distinguishes zero from missing population", async () => {
  const members = atlasPopulationGeography.regions[0]!.members
  const observations = members.map((reportingCode) => ({
    reportingCode,
    year: 2024,
    population: 0,
    source: "ONS",
    sourceUrl: "https://ons.gov.uk",
    licence: "OGL",
  }))
  const bridge = vi.fn().mockResolvedValue({
    observations,
    geography: { version: atlasLocalGeography.version },
  })
  const backend = {
    bridge,
    state: vi.fn(),
    search: vi.fn(),
  } as unknown as AtlasBackend
  const result = await queryPopulationDensity(backend, "regions")
  expect(result.areas[0]!.population).toBe(0)
  expect(result.areas[0]!.peoplePerKm2).toBe(0)
  expect(result.areas[1]!.peoplePerKm2).toBeNull()
  expect(backend.search).not.toHaveBeenCalled()
  expect(bridge).toHaveBeenCalledWith("/api/atlas/population/local")
  observations.pop()
  expect(
    (await queryPopulationDensity(backend, "regions")).areas[0]!.peoplePerKm2
  ).toBeNull()
})
it("rejects mixed-vintage, duplicate and oversized catalogues before displaying a density", async () => {
  const row = { reportingCode: "E1", year: 2023, population: 10 }
  const backend = {
    bridge: vi.fn().mockResolvedValue({ observations: [row] }),
    state: vi.fn(),
    search: vi.fn(),
  } as unknown as AtlasBackend
  await expect(queryPopulationDensity(backend, "local")).rejects.toThrow(
    "Invalid"
  )
  row.year = 2024
  vi.mocked(backend.bridge).mockResolvedValue({ observations: [row, row] })
  await expect(queryPopulationDensity(backend, "local")).rejects.toThrow(
    "Invalid"
  )
  vi.mocked(backend.bridge).mockResolvedValue({
    observations: Array.from({ length: 1025 }).fill(row),
  })
  await expect(queryPopulationDensity(backend, "local")).rejects.toThrow(
    "budget"
  )
})
it("uses a newer country-specific municipal observation only with matching boundary codes and vintage", async () => {
  const row = {
    level: "area",
    reportingCode: "0114",
    name: "Upplands Väsby",
    population: 50000,
    year: 2025,
    boundaryVersion: "2025-01-01",
    source: "SCB",
    sourceUrl: "https://scb.se",
    licence: "CC0",
  }
  const bridge = vi.fn(async (path: string) =>
    path.includes("population/context")
      ? { observations: [row] }
      : path.includes("catalogue")
        ? {
            releases: [
              {
                id: "administrative-se-test",
                country: "SE",
                theme: "administrative",
                level: "local",
                boundaryDate: "2025-01-01",
                year: 2025,
              },
            ],
          }
        : {
            features: [
              {
                properties: {
                  code: "0114",
                  name: "0114",
                  areaKm2: 100,
                  bounds: { west: 17, east: 18, south: 59, north: 60 },
                },
              },
            ],
          }
  )
  const backend = {
    bridge,
    state: vi.fn(),
    search: vi.fn(),
  } as unknown as AtlasBackend
  const result = await queryPopulationDensity(backend, "local", "SE")
  expect(result.areas[0]).toMatchObject({
    name: "Upplands Väsby",
    year: 2025,
    peoplePerKm2: 500,
    population: 50000,
  })
  expect(backend.search).not.toHaveBeenCalled()
  row.boundaryVersion = "2026-01-01"
  await expect(queryPopulationDensity(backend, "local", "SE")).rejects.toThrow(
    "vintage"
  )
})
