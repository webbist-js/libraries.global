import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  emptyAtlasFilters,
  parseAtlasNetworkReachResult,
} from "@repo/shared-data"

import { parseArgs, flag } from "../_shared/cli"

async function main() {
  process.loadEnvFile(path.resolve(__dirname, "../../../.env"))
  const args = parseArgs(),
    host = new URL(process.env.STRAPI_URL ?? "http://127.0.0.1:1337")
  if (
    !flag(args, "local") ||
    !["localhost", "127.0.0.1"].includes(host.hostname)
  )
    throw new Error("Explicit --local required")
  const headers = {
    "content-type": "application/json",
    "x-service-secret": process.env.STRAPI_BRIDGE_SECRET!,
    "x-atlas-token": process.env.ATLAS_SERVICE_TOKEN!,
  }
  const { StrapiClient } = await import("../../strapi-client")
  const networks = await new StrapiClient().findAll("library-networks")
  const report = []
  for (const [key, areaCode] of [
    ["libraryon:england:leicester", "E06000016"],
    ["libraryon:wales:cardiff", "W06000015"],
    ["libraryon:scotland:city-of-edinburgh", "S12000036"],
    ["libraryon:northern-ireland:libraries-ni", "N09000003"],
  ]) {
    const network = networks.find((item) => item.sourceKey === key)
    if (!network) throw new Error(`Missing ${key}`)
    const request = {
      schemaVersion: 1,
      networkId: network.documentId,
      areaCode,
      mode: args.mode === "cycling" ? "cycling" : "walking",
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    }
    const body = JSON.stringify({
      request,
      userKey: createHash("sha256")
        .update("local-network-acceptance")
        .digest("hex"),
      hourlyLimit: 20,
    })
    const started = Date.now()
    let result: { state?: string }
    for (;;) {
      const response = await fetch(new URL("/api/atlas/network-reach", host), {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      })
      result = await response.json()
      if (!response.ok)
        throw new Error(
          `Network request ${response.status}: ${JSON.stringify(result)}`
        )
      if (result.state !== "pending") break
      if (Date.now() - started > 300000)
        throw new Error("Network acceptance timed out")
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    const verified = parseAtlasNetworkReachResult(result)
    const cachedAt = Date.now()
    const cached = await fetch(new URL("/api/atlas/network-reach", host), {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    })
    const cachedResult = parseAtlasNetworkReachResult(await cached.json())
    if (cachedResult.selectionHash !== verified.selectionHash)
      throw new Error("Unstable cached network identity")
    const row = {
      network: network.name,
      areaCode,
      mode: verified.mode,
      state: verified.state,
      selectedLibraries: verified.selectedLibraries,
      unavailableLibraries: verified.unavailableLibraries,
      totalResidents: verified.totalResidents,
      populationYear: verified.population.year,
      bands: verified.contours.map(
        ({ geometry: _geometry, gapGeometry: _gap, ...band }) => band
      ),
      firstMs: cachedAt - started,
      cachedMs: Date.now() - cachedAt,
    }
    report.push(row)
    console.log(JSON.stringify(row))
  }
  const directory = path.resolve(__dirname, ".runs")
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    path.join(directory, `network-acceptance-${args.mode ?? "walking"}.json`),
    JSON.stringify(report, null, 2)
  )
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
