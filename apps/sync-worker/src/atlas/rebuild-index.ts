import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"

import { ATLAS_LIMITS, atlasDensityIndexProjection } from "@repo/shared-data"

import type { AtlasMeiliIndex } from "./meili-index"
import type { AtlasStore } from "./store"

const MARKER = "_atlas-index-epoch"

/** A staging scan and journal replay with a durable drain/swap barrier. */
export class AtlasIndexRebuild {
  private prepared = new Set<string>()
  constructor(
    readonly store: AtlasStore,
    readonly index: AtlasMeiliIndex
  ) {}

  async begin(token: string): Promise<void> {
    await this.store.db.transaction(async (trx) => {
      const state = await this.store.fenced(trx, token)
      if (state.rebuild && state.rebuild.phase !== "complete") return
      const upper = await trx("atlas_records").max("atlas_id as upper").first()
      await trx("atlas_state")
        .where({ key: "current" })
        .update({
          rebuild: JSON.stringify({
            phase: "scan",
            staging: `atlas-library-staging-${randomUUID()}`,
            epoch: randomUUID(),
            after: "0",
            upper: String(upper?.upper ?? 0),
            fromRevision: String(state.projection_revision),
            replayAfter: String(state.projection_revision),
            writerPaused: false,
            oldIndexToDelete: state.rebuild?.previousIndex ?? null,
          }),
        })
    })
  }

  private async save(token: string, checkpoint: any) {
    await this.store.db.transaction(async (trx) => {
      await this.store.fenced(trx, token)
      await trx("atlas_state")
        .where({ key: "current" })
        .update({ rebuild: JSON.stringify(checkpoint) })
    })
  }

  async step(token: string): Promise<boolean> {
    const state = await this.store
        .db("atlas_state")
        .where({ key: "current" })
        .first(),
      checkpoint = state.rebuild
    if (!checkpoint) return false
    if (checkpoint.phase === "complete") {
      if (
        checkpoint.oldIndexToDelete &&
        checkpoint.oldIndexToDelete !== checkpoint.previousIndex
      ) {
        const old = checkpoint.oldIndexToDelete
        if (!/^atlas-library-staging-[a-f0-9-]{36}$/.test(old))
          throw new Error("Invalid retained Atlas index")
        await this.store.db.transaction((trx) => this.store.fenced(trx, token))
        try {
          const task = await this.index.request(`/indexes/${old}`, "DELETE")
          await this.index.wait(task.taskUid)
        } catch (error) {
          if ((error as { status?: number }).status !== 404) throw error
        }
        await this.save(token, { ...checkpoint, oldIndexToDelete: null })
      }

      return false
    }
    const stage = checkpoint.staging
    if (!/^atlas-library-staging-[a-f0-9-]{36}$/.test(stage))
      throw new Error("Invalid Atlas staging checkpoint")
    if (checkpoint.phase === "scan") {
      if (!this.prepared.has(stage)) {
        await this.index.ensure(token, stage)
        this.prepared.add(stage)
      }
      const rows = await this.store
        .db("atlas_records")
        .where("atlas_id", ">", checkpoint.after)
        .where("atlas_id", "<=", checkpoint.upper)
        .orderBy("atlas_id")
        .limit(ATLAS_LIMITS.indexBatch)
        .select("atlas_id", "active", "projection")
      const upserts = rows
        .filter((row) => row.active)
        .map((row) => row.projection)
      if (upserts.length) await this.submit(stage, upserts)
      await this.store.db.transaction(async (trx) => {
        const current = await this.store.fenced(trx, token)
        const complete = rows.length < ATLAS_LIMITS.indexBatch
        await trx("atlas_state")
          .where({ key: "current" })
          .update({
            rebuild: JSON.stringify({
              ...checkpoint,
              after: String(rows.at(-1)?.atlas_id ?? checkpoint.after),
              ...(complete
                ? {
                    phase: "drain",
                    writerPaused: true,
                    throughRevision: String(current.projection_revision),
                  }
                : {}),
            }),
          })
      })

      return true
    }
    if (checkpoint.phase === "drain") {
      // Projection pauses briefly at this barrier. Canonical writes continue
      // queueing; the live writer drains every accepted batch before swapping.
      if (BigInt(state.indexed_through) < BigInt(checkpoint.throughRevision)) {
        await this.index.flush(token, true)

        return true
      }
      await this.save(token, { ...checkpoint, phase: "replay" })

      return true
    }
    if (checkpoint.phase === "replay") {
      const rows = await this.store
        .db("atlas_changes")
        .where("revision", ">", checkpoint.replayAfter)
        .where("revision", "<=", checkpoint.throughRevision)
        .orderBy("revision")
        .limit(ATLAS_LIMITS.indexBatch)
        .select("revision", "document_id", "new_projection")
      const latest = new Map<string, any>(
        rows.map((row) => [row.document_id, row.new_projection])
      )
      const upserts = [...latest.values()].filter(Boolean),
        removed = [...latest.entries()]
          .filter(([, value]) => value === null)
          .map(([id]) => id)
      if (upserts.length) await this.submit(stage, upserts)
      if (removed.length) {
        const task = await this.index.request(
          `/indexes/${stage}/documents/delete-batch`,
          "POST",
          removed
        )
        await this.index.wait(task.taskUid)
      }
      const after = String(rows.at(-1)?.revision ?? checkpoint.replayAfter)
      await this.save(token, {
        ...checkpoint,
        replayAfter: after,
        phase:
          BigInt(after) >= BigInt(checkpoint.throughRevision)
            ? "verify"
            : "replay",
      })
      if (!rows.length && BigInt(after) < BigInt(checkpoint.throughRevision))
        throw new Error("Atlas rebuild journal gap")

      return true
    }
    if (checkpoint.phase === "verify") {
      // Document reads give an exact filtered total and work with the writer's
      // existing documents.get permission. The epoch marker has no locale.
      const query = new URLSearchParams({
        filter: `locale = ${JSON.stringify(state.canonical_locale)}`,
        limit: "0",
      })
      const result = await this.index.request(
        `/indexes/${stage}/documents?${query}`
      )
      const count = result.total
      const expected = await this.store
        .db("atlas_records")
        .where({ active: true })
        .count("* as n")
        .first()
      if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        BigInt(count) !== BigInt(expected!.n as string)
      )
        throw new Error("Atlas staging exact count mismatch")
      const samples = await this.store
        .db("atlas_records")
        .where({ active: true })
        .orderBy("atlas_id")
        .limit(20)
        .select("document_id", "projection")
      for (const sample of samples) {
        const actual = await this.index.request(
          `/indexes/${stage}/documents/${encodeURIComponent(sample.document_id)}`
        )
        if (
          !isDeepStrictEqual(
            actual,
            atlasDensityIndexProjection(sample.projection)
          )
        )
          throw new Error("Atlas staging sample mismatch")
      }
      await this.submit(stage, [
        { documentId: MARKER, epoch: checkpoint.epoch },
      ])
      await this.save(token, { ...checkpoint, phase: "swap" })

      return true
    }
    if (checkpoint.phase === "swap") {
      let swapped = await this.markerMatches(checkpoint.epoch)
      if (!swapped) {
        let taskUid = checkpoint.swapTask
        if (taskUid === undefined) {
          // Recover the narrow accepted-request-before-checkpoint crash window.
          // This unique staging UID cannot belong to a different swap.
          const tasks = await this.index.request(
            `/tasks?types=indexSwap&indexUids=${encodeURIComponent(stage)}&limit=10`
          )
          const prior = tasks.results?.find((task: any) =>
            ["enqueued", "processing", "succeeded"].includes(task.status)
          )
          if (prior) taskUid = prior.uid
          else {
            const task = await this.index.request("/swap-indexes", "POST", [
              { indexes: [this.index.index, stage] },
            ])
            taskUid = task.taskUid
          }
          await this.save(token, { ...checkpoint, swapTask: taskUid })
        }
        try {
          await this.index.wait(taskUid)
        } catch (error) {
          if (
            error instanceof Error &&
            / (failed|canceled)$/.test(error.message)
          ) {
            const retry = { ...checkpoint }
            delete retry.swapTask
            await this.save(token, retry)
          }
          throw error
        }
        swapped = await this.markerMatches(checkpoint.epoch)
      }
      if (!swapped)
        throw new Error("Atlas swap marker mismatch; writer remains paused")
      await this.store.db.transaction(async (trx) => {
        await this.store.fenced(trx, token)
        await trx("atlas_state")
          .where({ key: "current" })
          .update({
            query_epoch: checkpoint.epoch,
            indexed_through: checkpoint.throughRevision,
            rebuild: JSON.stringify({
              ...checkpoint,
              phase: "complete",
              previousIndex: stage,
              writerPaused: false,
              completedAt: new Date().toISOString(),
            }),
          })
      })

      return false
    }
    throw new Error("Unknown Atlas rebuild phase")
  }

  private async submit(stage: string, rows: any[]) {
    const task = await this.index.request(
      `/indexes/${stage}/documents`,
      "POST",
      rows.map(atlasDensityIndexProjection)
    )
    await this.index.wait(task.taskUid)
  }

  private async markerMatches(epoch: string): Promise<boolean> {
    try {
      return (
        (
          await this.index.request(
            `/indexes/${this.index.index}/documents/${MARKER}`
          )
        ).epoch === epoch
      )
    } catch (error) {
      if ((error as { status?: number }).status === 404) return false
      throw error
    }
  }
}
