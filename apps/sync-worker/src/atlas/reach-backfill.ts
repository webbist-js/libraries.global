import "dotenv/config"
import { createHash } from "node:crypto"
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  atlasDisplayCoordinate,
  parseAtlasReachResult,
  type AtlasCoordinate,
} from "@repo/shared-data"
import knex from "knex"

import { AtlasSourceClient } from "./source-client"

function required(key: string) {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is required`)

  return value
}

async function verifiedResult(
  resultKey: string,
  libraryId: string,
  mode: string,
  coordinateHash: string
) {
  const response = await fetch(
    new URL(`/results/${resultKey}`, required("ANALYSIS_SERVICE_URL")),
    {
      headers: { "x-analysis-token": required("ANALYSIS_SERVICE_TOKEN") },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    }
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Analysis artifact HTTP ${response.status}`)
  const result = parseAtlasReachResult(await response.json())
  if (
    result.libraryId !== libraryId ||
    result.coordinateHash !== coordinateHash ||
    result.mode !== mode
  )
    throw new Error("Stale result")

  return result
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((value) => value.replace(/^--/, "").split("="))
  )
  const country = args.country ?? "GB-ENG"
  if (!/^[A-Z]{2}(?:-[A-Z]{3})?$/.test(country))
    throw new Error("Expected a country reporting code")
  const apply = process.argv.includes("--apply")
  const verify = process.argv.includes("--verify")
  if (verify && apply)
    throw new Error("Verification is read-only; choose --verify or --apply")
  const repair = process.argv.includes("--repair")
  const retryFailed = process.argv.includes("--retry-failed")
  if ((repair || retryFailed) && !apply)
    throw new Error("Repair/retry requires --apply")
  const headers = {
    "x-atlas-token": required("ATLAS_SERVICE_TOKEN"),
    "x-service-secret": required("STRAPI_BRIDGE_SECRET"),
  }
  const countriesResponse = await fetch(
    new URL("/api/atlas/countries", required("STRAPI_URL")),
    { headers, signal: AbortSignal.timeout(15000) }
  )
  if (!countriesResponse.ok)
    throw new Error("Atlas country catalogue unavailable")
  const catalogue = (await countriesResponse.json()) as {
    countries: { iso2: string; documentId: string }[]
  }
  const owner = catalogue.countries.find((row) => row.iso2 === country)
  if (!owner) throw new Error("Country is not in the CMS catalogue")
  const releasesResponse = await fetch(
    new URL("/releases", required("ANALYSIS_SERVICE_URL")),
    {
      headers: { "x-analysis-token": required("ANALYSIS_SERVICE_TOKEN") },
      signal: AbortSignal.timeout(10000),
    }
  )
  if (!releasesResponse.ok)
    throw new Error("Analysis release catalogue unavailable")
  const releases = (await releasesResponse.json()) as {
    id: string
    countries: string[]
    originBounds: number[]
  }[]
  const active = releases.filter((release) =>
    release.countries.includes(country)
  )
  if (!active.length)
    throw new Error("No active analysis release for this country")
  const source = new AtlasSourceClient(
    required("STRAPI_URL"),
    required("STRAPI_BRIDGE_SECRET"),
    required("ATLAS_SERVICE_TOKEN")
  )
  const db = knex({
    client: "pg",
    connection: required("ATLAS_DATABASE_URL"),
    pool: { min: 0, max: 1 },
  })
  const counts = {
    records: 0,
    eligible: 0,
    excluded: 0,
    unsupported: 0,
    queued: 0,
    existing: 0,
    repaired: 0,
    retried: 0,
    ready: 0,
    partial: 0,
    contours: 0,
    unroutable: 0,
    missingPopulation: 0,
    failed: 0,
    pending: 0,
  }
  const outcomes: object[] = []
  const exclusions: object[] = []
  let after = 0,
    upper: number | undefined
  try {
    if (apply) {
      await db("atlas_analysis_jobs")
        .where("expires_at", "<", new Date())
        .delete()
      await db("atlas_analysis_jobs")
        .whereNotIn(
          "release_id",
          releases.map((release) => release.id)
        )
        .delete()
    }
    for (;;) {
      // Scan the complete canonical CMS country, not the imported dataset or
      // current map index: neither can prove national analytical completeness.
      const page = await source.scan(after, upper, 200, country)
      upper = page.upper
      const rows = page.rows
      if (!rows.length) break
      const admissions: ({ key: string } & Record<string, unknown>)[] = []
      const resetKeys: string[] = []
      for (const row of rows) {
        counts.records++
        const library = row.source
        if (library.country?.documentId !== owner.documentId)
          throw new Error("Source country mismatch")
        if (
          !library ||
          !library.published ||
          !atlasDisplayCoordinate(library.location) ||
          ["Mobile", "Digital"].includes(library.libraryType ?? "") ||
          ["permanently_closed", "planned"].includes(
            library.operationalStatus ?? ""
          )
        ) {
          counts.excluded++
          exclusions.push({
            libraryId: library.documentId,
            reason: !atlasDisplayCoordinate(library.location)
              ? "unmapped"
              : library.libraryType === "Mobile" ||
                  library.libraryType === "Digital"
                ? library.libraryType
                : (library.operationalStatus ?? "unpublished"),
          })
          continue
        }
        counts.eligible++
        const coordinate = library.location as AtlasCoordinate
        const matching = active.filter(
          (release) =>
            release.originBounds[0]! <= coordinate.lng &&
            release.originBounds[2]! >= coordinate.lng &&
            release.originBounds[1]! <= coordinate.lat &&
            release.originBounds[3]! >= coordinate.lat
        )
        if (matching.length !== 1) {
          counts.unsupported++
          exclusions.push({
            libraryId: library.documentId,
            reason: "unsupported_origin",
          })
          continue
        }
        const release = matching[0]!
        const coordinateHash = createHash("sha256")
          .update(JSON.stringify([coordinate.lat, coordinate.lng]))
          .digest("hex")
        for (const mode of ["walking", "cycling"]) {
          const key = createHash("sha256")
            .update(
              JSON.stringify([
                library.documentId,
                coordinateHash,
                mode,
                release.id,
                "reach-v1",
              ])
            )
            .digest("hex")
          let existing = await db("atlas_analysis_jobs")
            .where({ key })
            .where("expires_at", ">", new Date())
            .first()
          if (apply && repair && existing?.state === "ready") {
            // A bounded file cache can evict an artifact before its metadata
            // expires. Recover that miss without treating an outage as expiry.
            const artifact = await verifiedResult(
              existing.result_key,
              library.documentId,
              mode,
              coordinateHash
            )
            if (artifact === null) {
              resetKeys.push(key)
              existing = undefined
              counts.repaired++
            }
          }
          if (apply && retryFailed && existing?.state === "failed") {
            resetKeys.push(key)
            existing = undefined
            counts.retried++
          }
          if (verify) {
            switch (existing?.state) {
              case "ready":
                try {
                  const result = await verifiedResult(
                    existing.result_key,
                    library.documentId,
                    mode,
                    coordinateHash
                  )
                  if (!result) throw new Error("Missing result artifact")
                  counts.ready++
                  counts.contours += result.contours.length
                  if (result.state === "partial") counts.partial++
                  outcomes.push({
                    libraryId: library.documentId,
                    mode,
                    key,
                    state: result.state,
                    contours: result.contours.length,
                    coordinateHash,
                    calculatedAt: result.calculatedAt,
                    snapDistanceMetres: result.snapDistanceMetres,
                    bands: result.contours.map(
                      ({ geometry: _geometry, ...band }) => band
                    ),
                  })
                } catch (error) {
                  counts.failed++
                  outcomes.push({
                    libraryId: library.documentId,
                    mode,
                    key,
                    state: "failed",
                    reason:
                      error instanceof Error
                        ? error.message
                        : "Invalid artifact",
                  })
                }

                break

              case "unroutable":
                counts.unroutable++
                break

              case "missing_population":
                counts.missingPopulation++
                break

              default:
                if (["failed", "unsupported"].includes(existing?.state))
                  counts.failed++
                else counts.pending++
            }
            if (existing?.state !== "ready")
              outcomes.push({
                libraryId: library.documentId,
                mode,
                key,
                state: existing?.state ?? "missing",
                reason: existing?.last_error ?? null,
              })
          } else if (existing) counts.existing++
          else {
            counts.queued++
            if (apply) {
              admissions.push({
                key,
                document_id: library.documentId,
                coordinate_hash: coordinateHash,
                release_id: release.id,
                mode,
                payload: JSON.stringify({
                  libraryId: library.documentId,
                  coordinateHash,
                  mode,
                  lat: coordinate.lat,
                  lng: coordinate.lng,
                  country,
                  release: release.id,
                }),
              })
            }
          }
        }
      }
      if (admissions.length) {
        await db.transaction(async (trx) => {
          // Share the interactive admission lock. Multiple country imports
          // must not race past the global metadata budget.
          await trx.raw("SELECT pg_advisory_xact_lock(7420124)")
          if (resetKeys.length)
            await trx("atlas_analysis_jobs")
              .whereIn("key", resetKeys)
              .whereIn("state", ["ready", "failed"])
              .delete()
          await trx("atlas_analysis_jobs")
            .whereIn(
              "key",
              admissions.map((row) => row.key)
            )
            .where("expires_at", "<", new Date())
            .delete()
          const known = new Set(
            (
              await trx("atlas_analysis_jobs")
                .whereIn(
                  "key",
                  admissions.map((row) => row.key)
                )
                .select("key")
            ).map((row) => row.key)
          )
          const fresh = admissions.filter((row) => !known.has(row.key))
          const size = await trx("atlas_analysis_jobs")
            .count("key as n")
            .first()
          if (Number(size?.n) + fresh.length > 10000)
            throw new Error(
              "Analysis metadata budget exceeded; prune obsolete releases before continuing"
            )
          if (fresh.length)
            await trx("atlas_analysis_jobs")
              .insert(fresh)
              .onConflict("key")
              .ignore()
          counts.queued -= admissions.length - fresh.length
          counts.existing += admissions.length - fresh.length
        })
      }
      after = rows.at(-1)!.id
      console.log(
        JSON.stringify({ country, dryRun: !apply, verify, ...counts, after })
      )
      if (page.next === null) break
    }
    const summary = {
      complete:
        counts.unsupported === 0 &&
        (!verify || counts.pending + counts.failed === 0),
      fullCoverage:
        verify &&
        counts.unsupported +
          counts.pending +
          counts.failed +
          counts.unroutable +
          counts.missingPopulation +
          counts.partial ===
          0,
      country,
      dryRun: !apply,
      verify,
      ...counts,
    }
    if (args.report) {
      if (!verify) throw new Error("--report requires --verify")
      const file = path.resolve(args.report)
      mkdirSync(path.dirname(file), { recursive: true })
      const temporary = `${file}.tmp`
      writeFileSync(
        temporary,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            releases: active,
            summary,
            outcomes,
            exclusions,
          },
          null,
          2
        ),
        { mode: 0o600 }
      )
      renameSync(temporary, file)
    }
    console.log(JSON.stringify(summary))
    if (counts.unsupported || (verify && counts.pending + counts.failed))
      process.exitCode = 1
  } finally {
    await db.destroy()
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- This worker CLI compiles to CommonJS.
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
