import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { once } from "node:events"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdtemp, rm, stat, statfs, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { atlasPoint, type AtlasManifest } from "@repo/shared-data"
import type { Knex } from "knex"

import { buildAtlasCountryArchive } from "./country-archive"

export type AtlasNativeRunner = (
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal
) => Promise<string>
export const runAtlasNative: AtlasNativeRunner = async (
  command,
  args,
  cwd,
  signal
) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (value) => {
      output += value.toString()
      if (output.length > 1024 * 1024) {
        child.kill()
        reject(new Error("Native output exceeded budget"))
      }
    })
    // Tippecanoe prints its version to stderr. Only capture that specific call;
    // other diagnostics can include private paths or credentials.
    if (command === "tippecanoe" && args.length === 1 && args[0] === "-v")
      child.stderr.on("data", (value) => {
        output += value.toString()
        if (output.length > 1024 * 1024) {
          child.kill()
          reject(new Error("Native output exceeded budget"))
        }
      })
    else child.stderr.resume()
    child.once("error", reject)
    child.once("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`Atlas native tool exited ${code}`))
    )
  })

export interface AtlasArchiveOptions {
  detailZoom: number
  directory?: string
  publicBaseUrl: string
  bucket: string
  endpoint: string
  validator: string
  origin: string
  runner?: AtlasNativeRunner
  countries?: { source: string; validator: string }
}

export async function verifyAtlasDelivery(
  url: string,
  size: number,
  origin: string,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(url, {
    headers: { range: "bytes=0-126", origin },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    redirect: "error",
    cache: "no-store",
  })
  try {
    const cors = response.headers.get("access-control-allow-origin")
    const exposed =
      response.headers.get("access-control-expose-headers")?.toLowerCase() ?? ""
    if (
      response.status !== 206 ||
      response.headers.get("content-range") !== `bytes 0-126/${size}` ||
      !response.headers.get("etag") ||
      !["*", origin].includes(cors ?? "") ||
      !["etag", "content-range"].every(
        (header) =>
          exposed === "*" ||
          exposed
            .split(",")
            .map((s) => s.trim())
            .includes(header)
      )
    )
      throw new Error("Atlas delivery failed range/CORS/ETag validation")
    // Read only the bounded range, even if a broken origin sends the whole file.
    const reader = response.body?.getReader()
    if (!reader) throw new Error("Missing archive range")
    let length = 0,
      magic = ""
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        length += chunk.value.length
        if (length > 127) throw new Error("Oversized range response")
        magic += Buffer.from(chunk.value).toString("latin1")
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    if (
      length !== 127 ||
      !magic.startsWith("PMTiles") ||
      magic.codePointAt(7) !== 3
    )
      throw new Error("Invalid PMTiles header")
  } finally {
    await response.body?.cancel().catch(() => {})
  }
}

/** Separate, leased CPU job. It never starts Strapi or the events importer. */
export async function buildAtlasArchive(
  db: Knex,
  options: AtlasArchiveOptions,
  signal: AbortSignal
): Promise<AtlasManifest | null> {
  if (
    !Number.isInteger(options.detailZoom) ||
    options.detailZoom < 10 ||
    options.detailZoom > 16
  )
    throw new RangeError("Atlas detail zoom must be measured in 10..16")
  for (const address of [options.publicBaseUrl, options.endpoint])
    if (new URL(address).protocol !== "https:")
      throw new RangeError("Atlas publication requires HTTPS")
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.bucket))
    throw new RangeError("Invalid archive bucket")
  const token = randomUUID(),
    run = options.runner ?? runAtlasNative
  const acquired = await db("atlas_state")
    .where({ key: "current" })
    .where((q) =>
      q.whereNull("build_until").orWhere("build_until", "<=", db.fn.now())
    )
    .whereRaw(
      "manifest IS NULL OR (manifest->>'builtAt')::timestamptz <= CURRENT_TIMESTAMP - INTERVAL '6 hours'"
    )
    .update({
      build_token: token,
      build_until: db.raw("CURRENT_TIMESTAMP + INTERVAL '60 seconds'"),
    })
  if (!acquired) return null
  const controller = new AbortController(),
    combined = AbortSignal.any([signal, controller.signal])
  const fence = async (trx: Knex | Knex.Transaction = db) => {
    const state = await trx("atlas_state")
      .where({ key: "current", build_token: token })
      .where("build_until", ">", trx.raw("clock_timestamp()"))
      .first()
    if (!state) throw new Error("Atlas build lease lost")

    return state
  }
  const heartbeat = setInterval(() => {
    db("atlas_state")
      .where({ key: "current", build_token: token })
      .where("build_until", ">", db.fn.now())
      .update({
        build_until: db.raw("CURRENT_TIMESTAMP + INTERVAL '60 seconds'"),
      })
      .then((n) => {
        if (!n) controller.abort()
      })
      .catch(() => controller.abort())
  }, 10000)
  let directory: string | undefined,
    uploadingBuildId: string | undefined,
    published = false
  try {
    const before = await fence(),
      upper = Number(
        (await db("atlas_records").max("atlas_id as upper").first())?.upper ?? 0
      )
    directory = await mkdtemp(
      path.join(options.directory ?? tmpdir(), "atlas-build-")
    )
    const tippecanoeVersion = await run(
      "tippecanoe",
      ["-v"],
      directory,
      combined
    )
    const pmtilesVersion = await run(
      "pmtiles",
      ["version"],
      directory,
      combined
    )
    if (
      !/^tippecanoe v2\.79\.0\s*$/m.test(tippecanoeVersion) ||
      !/^pmtiles (?:v)?1\.31\.2(?:,|\s|$)/m.test(pmtilesVersion)
    )
      throw new Error("Atlas requires Tippecanoe 2.79.0 and PMTiles CLI 1.31.2")
    const free = await statfs(directory),
      freeBytes = Number(free.bavail) * Number(free.bsize)
    const estimate = await db("atlas_records")
      .where({ active: true })
      .select(db.raw("COALESCE(SUM(pg_column_size(projection)),0) AS bytes"))
      .first()
    if (freeBytes < Math.max(1024 ** 3, Number(estimate.bytes) * 12))
      throw new Error("Insufficient Atlas build scratch space")
    const output = createWriteStream(path.join(directory, "source.ndjson"), {
      flags: "wx",
    })
    // Attach before writing so stream errors never become unhandled events.
    let streamError: Error | undefined
    output.on("error", (error) => {
      streamError = error
    })
    let after = 0,
      count = 0,
      sourceBytes = 0
    const bounds = { west: 180, east: -180, south: 90, north: -90 }
    try {
      for (;;) {
        combined.throwIfAborted()
        await fence()
        const rows = await db("atlas_records")
          .where({ active: true })
          .where("atlas_id", ">", after)
          .where("atlas_id", "<=", upper)
          .orderBy("atlas_id")
          .limit(1000)
          .select("atlas_id", "projection")
        if (!rows.length) break
        for (const row of rows) {
          const feature = atlasPoint(row.projection),
            line = `${JSON.stringify(feature)}\n`
          bounds.west = Math.min(bounds.west, feature.geometry.coordinates[0])
          bounds.east = Math.max(bounds.east, feature.geometry.coordinates[0])
          bounds.south = Math.min(bounds.south, feature.geometry.coordinates[1])
          bounds.north = Math.max(bounds.north, feature.geometry.coordinates[1])
          sourceBytes += Buffer.byteLength(line)
          if (sourceBytes * 12 > freeBytes - 512 * 1024 ** 2)
            throw new Error("Atlas scratch budget exceeded")
          if (streamError) throw streamError
          if (!output.write(line)) await once(output, "drain")
          count++
        }
        after = Number(rows.at(-1).atlas_id)
      }
      output.end()
      await once(output, "finish")
    } finally {
      output.destroy()
    }
    if (!count)
      throw new Error("Empty Atlas source; retaining current manifest")
    const scanned = await fence()
    if (
      scanned.query_epoch !== before.query_epoch ||
      scanned.canonical_locale !== before.canonical_locale
    )
      throw new Error("Atlas generation changed during scan")
    await run(
      "tippecanoe",
      [
        "-o",
        "archive.mbtiles",
        "-l",
        "libraries",
        "-Z",
        String(options.detailZoom),
        "-z16",
        "-B",
        String(options.detailZoom),
        "-r1",
        "-M512000",
        "-O200000",
        "source.ndjson",
      ],
      directory,
      combined
    )
    const validation = JSON.parse(
      await run(
        "python3",
        [
          options.validator,
          "archive.mbtiles",
          "source.ndjson",
          String(options.detailZoom),
          String(upper),
        ],
        directory,
        combined
      )
    )
    if (validation.complete !== true || validation.sourceCount !== count)
      throw new Error("Incomplete Atlas validation")
    await run(
      "pmtiles",
      ["convert", "archive.mbtiles", "archive.pmtiles"],
      directory,
      combined
    )
    await run("pmtiles", ["verify", "archive.pmtiles"], directory, combined)
    const archive = path.join(directory, "archive.pmtiles"),
      hash = createHash("sha256")
    for await (const chunk of createReadStream(archive)) {
      combined.throwIfAborted()
      hash.update(chunk)
    }
    const final = await fence()
    if (
      final.query_epoch !== before.query_epoch ||
      BigInt(final.journal_floor) > BigInt(before.projection_revision) ||
      BigInt(final.indexed_through) < BigInt(scanned.projection_revision)
    )
      throw new Error("Atlas archive baseline cannot be reconciled")
    const buildId = randomUUID(),
      key = `atlas/${buildId}/archive.pmtiles`
    const manifest: AtlasManifest = {
      schemaVersion: 1,
      projectionVersion: 1,
      dictionaryVersion: final.dictionary.version,
      buildId,
      url: new URL(
        key,
        options.publicBaseUrl.endsWith("/")
          ? options.publicBaseUrl
          : `${options.publicBaseUrl}/`
      ).toString(),
      builtAt: new Date().toISOString(),
      sourceStartRevision: String(before.projection_revision),
      sourceEndRevision: String(scanned.projection_revision),
      builtAgainstQueryEpoch: before.query_epoch,
      canonicalLocale: before.canonical_locale,
      sourceLayer: "libraries",
      detailZoom: options.detailZoom,
      maxZoom: 16,
      count,
      bounds,
      archiveBytes: (await stat(archive)).size,
      sha256: hash.digest("hex"),
      attribution: "libraries.global contributors; see /knowledge for licences",
    }
    const aws = async (args: string[]) => {
      await fence()

      return run(
        "aws",
        ["--endpoint-url", options.endpoint, ...args],
        directory!,
        combined
      )
    }
    if (options.countries) {
      manifest.countryTiles = await buildAtlasCountryArchive(
        {
          ...options.countries,
          directory,
          run,
          url: new URL(
            `atlas/${buildId}/countries.pmtiles`,
            options.publicBaseUrl.endsWith("/")
              ? options.publicBaseUrl
              : `${options.publicBaseUrl}/`
          ).toString(),
        },
        combined
      )
      await fence()
    }
    uploadingBuildId = buildId
    await aws([
      "s3",
      "cp",
      archive,
      `s3://${options.bucket}/${key}`,
      "--content-type",
      "application/vnd.pmtiles",
      "--cache-control",
      "public,max-age=31536000,immutable",
      "--only-show-errors",
    ])
    await verifyAtlasDelivery(
      manifest.url,
      manifest.archiveBytes,
      options.origin,
      combined
    )
    if (manifest.countryTiles) {
      await aws([
        "s3",
        "cp",
        path.join(directory, "countries.pmtiles"),
        `s3://${options.bucket}/atlas/${buildId}/countries.pmtiles`,
        "--content-type",
        "application/vnd.pmtiles",
        "--cache-control",
        "public,max-age=31536000,immutable",
        "--only-show-errors",
      ])
      await verifyAtlasDelivery(
        manifest.countryTiles.url,
        manifest.countryTiles.archiveBytes,
        options.origin,
        combined
      )
    }
    const manifestFile = path.join(directory, "manifest.json")
    await writeFile(manifestFile, JSON.stringify(manifest))
    await aws([
      "s3",
      "cp",
      manifestFile,
      `s3://${options.bucket}/atlas/${buildId}/manifest.json`,
      "--content-type",
      "application/json",
      "--cache-control",
      "public,max-age=31536000,immutable",
      "--only-show-errors",
    ])
    let expired: AtlasManifest[] = []
    // Only the DB pointer is mutable. Fencing and the generation check occur in
    // the same transaction that makes this archive discoverable to clients.
    await db.transaction(async (trx) => {
      await trx("atlas_state").where({ key: "current" }).forUpdate().first()
      const current = await fence(trx)
      if (
        current.query_epoch !== before.query_epoch ||
        BigInt(current.journal_floor) > BigInt(before.projection_revision)
      )
        throw new Error("Atlas publication generation expired")
      const previous = [
        current.manifest,
        ...(current.archive_history ?? []),
      ].filter(Boolean) as AtlasManifest[]
      expired = previous.slice(2)
      await trx("atlas_state")
        .where({ key: "current", build_token: token })
        .update({
          manifest: JSON.stringify(manifest),
          archive_history: JSON.stringify(previous.slice(0, 2)),
        })
    })
    published = true
    for (const old of expired) {
      if (!/^[a-f0-9-]{36}$/.test(old.buildId))
        throw new Error("Invalid retained archive ID")
      await aws([
        "s3",
        "rm",
        `s3://${options.bucket}/atlas/${old.buildId}/`,
        "--recursive",
        "--only-show-errors",
      ])
    }

    return manifest
  } catch (error) {
    // Only clean this job's unpublished prefix. An ambiguous DB commit must be
    // checked against both retained pointers before deleting anything.
    if (uploadingBuildId && directory && !published) {
      try {
        const state = await db("atlas_state")
          .where({ key: "current" })
          .first("manifest", "archive_history")
        const referenced = [
          state?.manifest,
          ...(state?.archive_history ?? []),
        ].some((manifest) => manifest?.buildId === uploadingBuildId)
        if (state && !referenced)
          await run(
            "aws",
            [
              "--endpoint-url",
              options.endpoint,
              "s3",
              "rm",
              `s3://${options.bucket}/atlas/${uploadingBuildId}/`,
              "--recursive",
              "--only-show-errors",
            ],
            directory,
            AbortSignal.timeout(5000)
          )
      } catch {
        console.error("[atlas-build] unpublished object cleanup needs retry")
      }
    }
    throw error
  } finally {
    clearInterval(heartbeat)
    if (directory) await rm(directory, { recursive: true, force: true })
    await db("atlas_state")
      .where({ key: "current", build_token: token })
      .update({ build_token: null, build_until: null })
  }
}
