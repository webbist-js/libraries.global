import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"

import {
  ATLAS_LIMITS,
  atlasOptionCode,
  type AtlasDictionary,
  type AtlasDictionaryEntry,
  type AtlasLibrarySource,
  type AtlasProjection,
} from "@repo/shared-data"
import type { Knex } from "knex"

export type AtlasJob = {
  id: string
  kind: "document" | "fanout"
  entity_id: string
  payload: {
    after?: number
    field?: string
    optionKind?: "access" | "service" | "amenity"
  }
  attempts: number
}
export class AtlasLeaseLost extends Error {
  constructor() {
    super("Atlas worker lease lost")
  }
}
const LEASE_SECONDS = 60
const retrySeconds = (attempts: number) =>
  Math.min(60, 2 ** Math.min(attempts, 6))
const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : "Atlas operation failed").slice(
    0,
    2000
  )

/** Only owned Atlas tables are accessed. Canonical CMS rows are read via HTTP. */
export class AtlasStore {
  constructor(
    readonly db: Knex,
    readonly owner: string
  ) {}

  async acquire(): Promise<string | null> {
    const token = randomUUID()
    const changed = await this.db("atlas_state")
      .where({ key: "current" })
      .where((query) =>
        query
          .whereNull("lease_until")
          .orWhere("lease_until", "<=", this.db.fn.now())
      )
      .update({
        lease_token: token,
        lease_owner: this.owner,
        lease_until: this.db.raw("CURRENT_TIMESTAMP + INTERVAL '60 seconds'"),
        heartbeat_at: this.db.fn.now(),
      })

    return changed ? token : null
  }

  async renew(token: string): Promise<void> {
    const changed = await this.db("atlas_state")
      .where({ key: "current", lease_token: token })
      .where("lease_until", ">", this.db.fn.now())
      .update({
        lease_until: this.db.raw("CURRENT_TIMESTAMP + INTERVAL '60 seconds'"),
        heartbeat_at: this.db.fn.now(),
      })
    if (!changed) throw new AtlasLeaseLost()
  }

  async release(token: string): Promise<void> {
    await this.db("atlas_state")
      .where({ key: "current", lease_token: token })
      .update({ lease_token: null, lease_owner: null, lease_until: null })
  }

  async fenced(trx: Knex.Transaction, token: string): Promise<any> {
    const state = await trx("atlas_state")
      .where({ key: "current", lease_token: token })
      .where("lease_until", ">", trx.raw("clock_timestamp()"))
      .forUpdate()
      .first()
    if (!state) throw new AtlasLeaseLost()

    return state
  }

  async claim(
    token: string,
    limit = ATLAS_LIMITS.projectionBatch
  ): Promise<AtlasJob[]> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > ATLAS_LIMITS.projectionBatch
    )
      throw new RangeError("Invalid claim limit")

    return this.db.transaction(async (trx) => {
      await this.fenced(trx, token)
      const rows = await trx("atlas_outbox")
        .whereNull("finished_at")
        .where("not_before", "<=", trx.fn.now())
        .where((q) =>
          q.whereNull("claim_until").orWhere("claim_until", "<=", trx.fn.now())
        )
        .orderBy("id")
        .limit(limit)
        .forUpdate()
        .skipLocked()
      if (rows.length)
        await trx("atlas_outbox")
          .whereIn(
            "id",
            rows.map((row) => row.id)
          )
          .update({
            claimed_by: token,
            claim_until: trx.raw(
              `CURRENT_TIMESTAMP + INTERVAL '${LEASE_SECONDS} seconds'`
            ),
          })

      return rows
    })
  }

  async fail(token: string, jobs: AtlasJob[], error: unknown): Promise<void> {
    if (!jobs.length) return
    await this.db.transaction(async (trx) => {
      await this.fenced(trx, token)
      for (const job of jobs)
        await trx("atlas_outbox")
          .where({ id: job.id, claimed_by: token })
          .whereNull("finished_at")
          .update({
            attempts: job.attempts + 1,
            not_before: trx.raw(
              "CURRENT_TIMESTAMP + (? * INTERVAL '1 second')",
              [retrySeconds(job.attempts)]
            ),
            claimed_by: null,
            claim_until: null,
            last_error: errorText(error),
          })
    })
  }

  async allocate(
    token: string,
    documentIds: string[]
  ): Promise<Map<string, number>> {
    if (
      !documentIds.length ||
      documentIds.length > ATLAS_LIMITS.projectionBatch
    )
      throw new RangeError("Invalid allocation batch")

    return this.db.transaction(async (trx) => {
      await this.fenced(trx, token)
      await trx("atlas_records")
        .insert(documentIds.map((document_id) => ({ document_id })))
        .onConflict("document_id")
        .ignore()
      const rows = await trx("atlas_records")
        .whereIn("document_id", documentIds)
        .select("document_id", "atlas_id")

      return new Map(rows.map((row) => [row.document_id, Number(row.atlas_id)]))
    })
  }

  async apply(
    token: string,
    jobs: AtlasJob[],
    projections: Map<string, AtlasProjection | null>,
    sources: Map<string, AtlasLibrarySource | null>
  ): Promise<number> {
    if (jobs.length > ATLAS_LIMITS.projectionBatch)
      throw new RangeError("Projection batch overflow")

    return this.db.transaction(async (trx) => {
      const state = await this.fenced(trx, token)
      const stillClaimed = await trx("atlas_outbox")
        .whereIn(
          "id",
          jobs.map((job) => job.id)
        )
        .where({ claimed_by: token })
        .whereNull("finished_at")
        .select("id")
      if (stillClaimed.length !== jobs.length) throw new AtlasLeaseLost()
      let revision = BigInt(state.projection_revision)
      const from = revision + 1n,
        upserts: AtlasProjection[] = [],
        removedIds: string[] = []
      for (const [documentId, projection] of projections) {
        const previous = await trx("atlas_records")
          .where({ document_id: documentId })
          .forUpdate()
          .first()
        if (!previous) throw new Error("Atlas ID was not allocated")
        // PostgreSQL JSONB reorders keys; structural equality also preserves
        // nested geometry comparisons and ignores omitted undefined fields.
        const encoded = JSON.stringify(projection)
        if (!isDeepStrictEqual(previous.projection, JSON.parse(encoded))) {
          revision++
          await trx("atlas_changes").insert({
            revision: revision.toString(),
            document_id: documentId,
            atlas_id: previous.atlas_id,
            old_projection: previous.projection
              ? JSON.stringify(previous.projection)
              : null,
            new_projection: projection ? JSON.stringify(projection) : null,
            old_lat: previous.latitude,
            old_lng: previous.longitude,
            new_lat: projection?.latitude ?? null,
            new_lng: projection?.longitude ?? null,
            removed: projection === null,
          })
          await trx("atlas_records")
            .where({ document_id: documentId })
            .update({
              active: projection !== null,
              projection: projection ? JSON.stringify(projection) : null,
              latitude: projection?.latitude ?? null,
              longitude: projection?.longitude ?? null,
              revision: revision.toString(),
            })
          if (projection) upserts.push(projection)
          else removedIds.push(documentId)
        }
        await trx("atlas_records")
          .where({ document_id: documentId })
          .update({
            clock_due: projection?.clock_valid_until ?? null,
            clock_queued: false,
            projected_at: trx.fn.now(),
          })
      }
      const dictionary = mergeAtlasDictionary(
        state.dictionary,
        [...sources.values()].filter(
          (source): source is AtlasLibrarySource => source !== null
        )
      )
      await trx("atlas_state")
        .where({ key: "current" })
        .update({
          projection_revision: revision.toString(),
          dictionary_version: dictionary.version,
          dictionary: JSON.stringify(dictionary),
        })
      if (revision >= from)
        await trx("atlas_index_batches").insert({
          from_revision: from.toString(),
          through_revision: revision.toString(),
          payload: JSON.stringify({ upserts, removedIds }),
        })
      // A mutation arriving during the HTTP read owns a different outbox ID and
      // remains pending, even when it concerns one of these same documents.
      if (jobs.length)
        await trx("atlas_outbox")
          .whereIn(
            "id",
            jobs.map((job) => job.id)
          )
          .where({ claimed_by: token })
          .update({
            finished_at: trx.fn.now(),
            claimed_by: null,
            claim_until: null,
            last_error: null,
          })

      return upserts.length + removedIds.length
    })
  }

  async fanout(token: string, job: AtlasJob): Promise<number> {
    return this.db.transaction(async (trx) => {
      await this.fenced(trx, token)
      const { field, optionKind, after = 0 } = job.payload
      if (
        field &&
        ![
          "continent_id",
          "country_id",
          "region_id",
          "area_id",
          "network_ids",
          "all",
        ].includes(field)
      )
        throw new Error("Invalid fan-out field")
      if (optionKind && !["access", "service", "amenity"].includes(optionKind))
        throw new Error("Invalid fan-out option kind")
      if ((!field && !optionKind) || !Number.isSafeInteger(after) || after < 0)
        throw new Error("Invalid fan-out job")
      const contains = field
        ? { [field]: field === "network_ids" ? [job.entity_id] : job.entity_id }
        : { facility_codes: [atlasOptionCode(optionKind!, job.entity_id)] }
      const rows = await trx("atlas_records")
        .where({ active: true })
        .where("atlas_id", ">", after)
        .modify((query) => {
          if (field !== "all")
            query.whereRaw("projection @> ?::jsonb", [JSON.stringify(contains)])
        })
        .orderBy("atlas_id")
        .limit(ATLAS_LIMITS.backfillBatch)
        .select("atlas_id", "document_id")
      if (rows.length)
        await trx("atlas_outbox").insert(
          rows.map((row: { document_id: string }) => ({
            kind: "document",
            entity_id: row.document_id,
          }))
        )
      const result = await trx("atlas_outbox")
        .where({ id: job.id, claimed_by: token })
        .whereNull("finished_at")
        .update({
          payload: JSON.stringify({
            ...job.payload,
            after: Number(rows.at(-1)?.atlas_id ?? after),
          }),
          finished_at:
            rows.length < ATLAS_LIMITS.backfillBatch ? trx.fn.now() : null,
          claimed_by: null,
          claim_until: null,
          last_error: null,
        })
      if (!result) throw new AtlasLeaseLost()

      return rows.length
    })
  }

  async clocks(token: string): Promise<number> {
    return this.db.transaction(async (trx) => {
      await this.fenced(trx, token)
      const rows = await trx("atlas_records")
        .where({ active: true, clock_queued: false })
        .where("clock_due", "<=", trx.fn.now())
        .orderBy("clock_due")
        .limit(ATLAS_LIMITS.projectionBatch)
        .forUpdate()
        .skipLocked()
        .select("document_id")
      if (rows.length) {
        await trx("atlas_outbox").insert(
          rows.map((row) => ({ kind: "document", entity_id: row.document_id }))
        )
        await trx("atlas_records")
          .whereIn(
            "document_id",
            rows.map((row) => row.document_id)
          )
          .update({ clock_queued: true })
      }

      return rows.length
    })
  }

  async prune(token: string): Promise<void> {
    await this.db.transaction(async (trx) => {
      const state = await this.fenced(trx, token)
      const eligible = trx("atlas_changes")
        .where(
          "created_at",
          "<",
          trx.raw("CURRENT_TIMESTAMP - INTERVAL '7 days'")
        )
        .where("revision", "<=", state.indexed_through)
      if (state.rebuild && state.rebuild.phase !== "complete")
        eligible.where("revision", "<=", state.rebuild.fromRevision)
      const revisions = await eligible
        .orderBy("revision")
        .limit(1000)
        .pluck("revision")
      if (revisions.length) {
        await trx("atlas_changes").whereIn("revision", revisions).delete()
        await trx("atlas_state")
          .where({ key: "current" })
          .update({
            journal_floor: (BigInt(revisions.at(-1)!) + 1n).toString(),
          })
      }
      const finished = await trx("atlas_outbox")
        .where(
          "finished_at",
          "<",
          trx.raw("CURRENT_TIMESTAMP - INTERVAL '7 days'")
        )
        .orderBy("id")
        .limit(1000)
        .pluck("id")
      if (finished.length)
        await trx("atlas_outbox").whereIn("id", finished).delete()
      const indexed = await trx("atlas_index_batches")
        .where(
          "completed_at",
          "<",
          trx.raw("CURRENT_TIMESTAMP - INTERVAL '7 days'")
        )
        .orderBy("id")
        .limit(1000)
        .pluck("id")
      if (indexed.length)
        await trx("atlas_index_batches").whereIn("id", indexed).delete()
    })
  }
}

export function mergeAtlasDictionary(
  previous: AtlasDictionary,
  sources: AtlasLibrarySource[]
): AtlasDictionary {
  const entries = new Map(previous.entries.map((entry) => [entry.code, entry]))
  let changed = false
  for (const source of sources)
    for (const [kind, options] of [
      ["access", source.accessibility],
      ["service", source.services],
      ["amenity", source.amenities],
    ] as const)
      for (const option of options ?? []) {
        const code = atlasOptionCode(kind, option.documentId),
          prior = entries.get(code)
        const entry: AtlasDictionaryEntry = {
          code,
          kind,
          name: option.name,
          aliases: [
            ...new Set([
              ...(prior?.aliases ?? []),
              ...(option.aliases ?? []),
              ...(prior ? [prior.name] : []),
            ]),
          ]
            .filter((name) => name !== option.name)
            .sort(),
        }
        if (isDeepStrictEqual(prior, entry)) continue
        entries.set(code, entry)
        changed = true
      }

  return changed
    ? {
        version: randomUUID(),
        entries: [...entries.values()].sort((a, b) =>
          a.code.localeCompare(b.code)
        ),
      }
    : previous
}
