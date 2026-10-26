import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { atlasCellId, atlasPoint, projectAtlasLibrary } from "@repo/shared-data"
import { expect, it } from "vitest"

import {
  prepareAtlasDensity,
  buildAtlasDensityArchive,
} from "../../src/atlas/density-archive"

it("prepares every zoom from actual eligible coordinates and conserves counts in both layers", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "density-test-"))
  try {
    const rows = [
      { location: { lat: 51.5, lng: -0.1 } },
      { location: { lat: 51.50001, lng: -0.10001 } },
      { location: { lat: 0, lng: 179.99 } },
      { location: { lat: 0, lng: -179.99 } },
      {
        location: { lat: 60, lng: 10 },
        operationalStatus: "permanently_closed",
      },
      {
        location: { lat: 52, lng: 1 },
        libraryType: "Mobile",
        mobileTimetable: {},
      },
    ].map((row, n) =>
      atlasPoint(
        projectAtlasLibrary(
          {
            documentId: String(n),
            name: String(n),
            slug: String(n),
            published: true,
            locale: "en",
            ...row,
          },
          { atlasId: n + 1, canonicalLocale: "en", now: new Date() }
        )!
      )
    )
    const source = path.join(directory, "source.ndjson")
    await writeFile(source, rows.map((row) => JSON.stringify(row)).join("\n"))
    const destination = path.join(directory, "density.ndjson")
    expect(
      (
        await prepareAtlasDensity(
          source,
          destination,
          new AbortController().signal
        )
      ).sourceCount
    ).toBe(4)
    const features = (await readFile(destination, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    for (let zoom = 0; zoom <= 16; zoom++) {
      for (const layer of ["density", "density-grid"]) {
        const cells = features.filter(
          (f) => f.tippecanoe.layer === layer && f.tippecanoe.minzoom === zoom
        )
        expect(
          cells.reduce((sum, cell) => sum + cell.properties.total, 0)
        ).toBe(4)
        expect(new Set(cells.map((f) => f.properties.cell)).size).toBe(
          cells.length
        )
        expect(
          cells.every(
            (f) =>
              f.tippecanoe.maxzoom === zoom &&
              f.properties.areaKm2 > 0 &&
              f.properties.per100Km2 > 0
          )
        ).toBe(true)
      }
    }
    const atStreet = features.filter(
      (f) =>
        f.tippecanoe.layer === "density-grid" && f.tippecanoe.minzoom === 16
    )
    expect(
      atStreet.find(
        (f) => f.properties.cell === atlasCellId({ lat: 51.5, lng: -0.1 }, 20)
      )?.properties.total
    ).toBe(2)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("does not publish a density archive if native verification loses cells", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "density-test-"))
  try {
    await writeFile(
      path.join(directory, "source.ndjson"),
      JSON.stringify({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { st: "open" },
      }) + "\n"
    )
    const commands: string[] = []
    await expect(
      buildAtlasDensityArchive(
        {
          directory,
          url: "https://cdn.test/density.pmtiles",
          validator: "/validator.py",
          run: async (command) => {
            commands.push(command)

            return command === "python3"
              ? JSON.stringify({ complete: false, sourceCount: 1 })
              : ""
          },
        },
        new AbortController().signal
      )
    ).rejects.toThrow("Incomplete")
    expect(commands).toEqual(["tippecanoe", "python3"])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
