import {
  ATLAS_LIMITS,
  atlasBoundsRanges,
  atlasInBounds,
  atlasPoint,
  atlasRevision,
  emptyAtlasFilters,
  parseAtlasScope,
  type AtlasBounds,
  type AtlasChangesResponse,
  type AtlasProjection,
} from "@repo/shared-data"

import { atlasJson } from "./atlas-json"

function geo(query: any, bounds: AtlasBounds, lat: string, lng: string): void {
  const ranges = atlasBoundsRanges(bounds)
  query
    .whereBetween(lat, [ranges[0]!.south, ranges[0]!.north])
    .where((longitude: any) => {
      for (const range of ranges)
        longitude.orWhereBetween(lng, [range.west, range.east])
    })
}

export function parseAtlasChangeRequest(input: any): {
  buildId: string
  since: string
  bbox: AtlasBounds
} {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !["buildId", "since", "bbox"].includes(key)
    ) ||
    typeof input.buildId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(input.buildId) ||
    typeof input.since !== "string" ||
    input.since.length > 19
  )
    throw new RangeError("Invalid Atlas change request")
  const since = atlasRevision(input.since)
  if (BigInt(since) > 9223372036854775807n)
    throw new RangeError("Invalid Atlas revision")
  const scope = parseAtlasScope({
    bbox: input.bbox,
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  })
  if (!scope.bbox) throw new RangeError("Viewport required")

  return { buildId: input.buildId, since, bbox: scope.bbox }
}

/** Read immutable journal states through the acknowledged index revision. */
export async function atlasChanges(
  db: any,
  request: ReturnType<typeof parseAtlasChangeRequest>
): Promise<AtlasChangesResponse> {
  return db
    .transaction(async (trx: any) => {
      // MVCC keeps retention/swap/watermark reads in one generation without
      // blocking the projection writer. No canonical reads occur.
      await trx.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
      await trx.raw("SET LOCAL statement_timeout = '1000ms'")
      const state = await trx("atlas_state").where({ key: "current" }).first()
      const manifest = atlasJson(state.manifest)
      if (
        !manifest ||
        manifest.buildId !== request.buildId ||
        manifest.builtAgainstQueryEpoch !== state.query_epoch ||
        BigInt(request.since) < BigInt(state.journal_floor) ||
        BigInt(request.since) < BigInt(manifest.sourceStartRevision) ||
        BigInt(request.since) > BigInt(state.indexed_through)
      )
        return { status: "expired", schemaVersion: 1 }
      if (BigInt(state.indexed_through) < BigInt(manifest.sourceEndRevision))
        throw new Error("Atlas archive baseline is not indexed")
      const through = String(state.indexed_through)
      const candidates = await trx("atlas_changes")
        .where("revision", ">", request.since)
        .where("revision", "<=", through)
        .where((query: any) => {
          query
            .where((old: any) => geo(old, request.bbox, "old_lat", "old_lng"))
            .orWhere((current: any) =>
              geo(current, request.bbox, "new_lat", "new_lng")
            )
        })
        .groupBy("document_id")
        .orderBy("document_id")
        .limit(ATLAS_LIMITS.deltaIds + 1)
        .pluck("document_id")
      if (candidates.length > ATLAS_LIMITS.deltaIds)
        return { status: "overflow", schemaVersion: 1 }
      const latest = candidates.length
        ? await trx("atlas_changes")
            .distinctOn("document_id")
            .whereIn("document_id", candidates)
            .where("revision", "<=", through)
            .orderBy("document_id")
            .orderBy("revision", "desc")
            .select("document_id", "new_projection")
        : []
      const result: AtlasChangesResponse = {
        status: "complete",
        schemaVersion: 1,
        buildId: request.buildId,
        since: request.since,
        throughRevision: through,
        upserts: [],
        removedIds: [],
      }
      for (const row of latest) {
        const projection = atlasJson<AtlasProjection | null>(row.new_projection)
        const visible =
          projection &&
          atlasInBounds(
            { lat: projection.latitude, lng: projection.longitude },
            request.bbox
          )
        if (visible) result.upserts.push(atlasPoint(projection))
        else result.removedIds.push(row.document_id)
      }
      if (Buffer.byteLength(JSON.stringify(result)) > ATLAS_LIMITS.deltaBytes)
        return { status: "overflow", schemaVersion: 1 }

      return result
    })
    .catch((error: any) => {
      if (error.code === "57014")
        return { status: "overflow", schemaVersion: 1 }
      throw error
    })
}

export async function atlasArchivePage(
  db: any,
  after: number,
  upper: number | undefined,
  limit: number
) {
  if (
    ![after, limit, ...(upper === undefined ? [] : [upper])].every(
      Number.isSafeInteger
    ) ||
    after < 0 ||
    limit < 1 ||
    limit > ATLAS_LIMITS.sourceBatch ||
    (upper !== undefined && upper < 0)
  )
    throw new RangeError("Invalid Atlas archive window")
  const high =
    upper ??
    Number(
      (await db("atlas_records").max("atlas_id as upper").first())?.upper ?? 0
    )
  const rows = await db("atlas_records")
    .where({ active: true })
    .where("atlas_id", ">", after)
    .where("atlas_id", "<=", high)
    .orderBy("atlas_id")
    .limit(limit)
    .select("atlas_id", "projection")

  return {
    upper: high,
    next: rows.length === limit ? Number(rows.at(-1)?.atlas_id) : null,
    points: rows.map((row: any) => atlasPoint(atlasJson(row.projection))),
  }
}

/** Export predicates run in Next.js; Strapi only reads a bounded journal window. */
export async function atlasExportJournal(db: any, input: any) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) =>
        !["since", "through", "queryEpoch", "dictionaryVersion"].includes(key)
    ) ||
    typeof input.queryEpoch !== "string" ||
    input.queryEpoch.length > 200 ||
    typeof input.dictionaryVersion !== "string" ||
    input.dictionaryVersion.length > 200
  )
    throw new RangeError("Invalid export validation")
  const since = atlasRevision(input.since),
    through = atlasRevision(input.through)
  if (
    since.length > 19 ||
    through.length > 19 ||
    BigInt(through) > 9223372036854775807n ||
    BigInt(since) > BigInt(through)
  )
    throw new RangeError("Invalid export revisions")

  return db
    .transaction(async (trx: any) => {
      await trx.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
      await trx.raw("SET LOCAL statement_timeout = '1000ms'")
      const state = await trx("atlas_state").where({ key: "current" }).first()
      if (
        state.query_epoch !== input.queryEpoch ||
        atlasJson(state.dictionary).version !== input.dictionaryVersion ||
        BigInt(since) < BigInt(state.journal_floor) ||
        String(state.projection_revision) !== through ||
        String(state.indexed_through) !== through
      )
        return { stable: false }
      // A committed canonical write may still be waiting for projection. It is
      // unsafe to validate an export until capture has drained into the journal.
      if (await trx("atlas_outbox").whereNull("finished_at").first("id"))
        return { stable: false }
      const rows = await trx("atlas_changes")
        .where("revision", ">", since)
        .where("revision", "<=", through)
        .orderBy("revision")
        .limit(ATLAS_LIMITS.deltaIds + 1)
        .select("old_projection", "new_projection")
      const changes = rows.map((row: any) => ({
        old_projection: atlasJson(row.old_projection),
        new_projection: atlasJson(row.new_projection),
      }))
      if (
        changes.length > ATLAS_LIMITS.deltaIds ||
        Buffer.byteLength(JSON.stringify(changes)) > 7 * 1024 * 1024
      )
        return { stable: false }

      return { stable: true, changes }
    })
    .catch((error: any) => {
      if (error.code === "57014") return { stable: false }
      throw error
    })
}
