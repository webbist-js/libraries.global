// apps/sync-worker/src/pipeline/sync.ts
import { randomUUID } from "node:crypto"

import pLimit from "p-limit"

import { loadCredentials } from "./load-credentials"
import { matchVenueToLibrary } from "./match-libraries"
import { normalizeEvent } from "./normalize"
import { purgeExpiredEvents } from "./purge"
import { upsertEvents } from "./upsert"
import { validateCredentials } from "./validate"
import {
  createRunRecord,
  updateRunProgress,
  finaliseRunRecord,
  updateCredentialStatus,
} from "./write-run"
import { getProvider } from "../providers"
import type { NormalizedEvent } from "../providers/types"

type TriggerType = "cron" | "manual"

export async function runSync(
  triggeredBy: TriggerType = "cron",
  triggeredByUserId?: number
): Promise<void> {
  const runId = randomUUID()
  const startedAt = new Date()
  console.log(`[sync] Starting run ${runId} (${triggeredBy})`)

  await createRunRecord(runId, triggeredBy, triggeredByUserId)

  const concurrency = Number(process.env.EVENTS_SYNC_CONCURRENCY ?? "50")
  const limit = pLimit(concurrency)

  let totalFetched = 0
  let totalCreated = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalPendingReview = 0
  let errorCount = 0
  const failedCredentials: {
    credentialId: number
    label: string
    error: string
  }[] = []
  const providerBreakdown: Record<
    string,
    { fetched: number; created: number; updated: number; errors: number }
  > = {}

  try {
    // Step 1+2: load + validate
    const all = await loadCredentials()
    const { valid, failed } = await validateCredentials(all)
    for (const f of failed) {
      failedCredentials.push({
        credentialId: f.credential.id,
        label: f.credential.label,
        error: f.error,
      })
      errorCount++
    }
    await updateRunProgress(runId, {
      credentialsAttempted: valid.length,
      credentialsFailed: failed.length,
    })

    // Steps 3-6 per credential, with concurrency limiting
    await Promise.all(
      valid.map((cred) =>
        limit(async () => {
          const pb = providerBreakdown[cred.provider] ?? {
            fetched: 0,
            created: 0,
            updated: 0,
            errors: 0,
          }
          providerBreakdown[cred.provider] = pb
          const provider = getProvider(cred.provider)
          if (!provider) return

          let rawEvents
          try {
            rawEvents = await provider.fetch(cred.credentials, cred.libraries)
          } catch (err: any) {
            pb.errors++
            errorCount++
            failedCredentials.push({
              credentialId: cred.id,
              label: cred.label,
              error: err.message as string,
            })
            await updateCredentialStatus(
              cred.id,
              "error",
              err.message as string
            )

            return
          }

          pb.fetched += rawEvents.length
          totalFetched += rawEvents.length

          // Steps 4+5: match + normalize
          const normalized: NormalizedEvent[] = []
          let credPendingReview = 0

          for (const raw of rawEvents) {
            if (cred.scope === "library") {
              const lib = cred.libraries[0]
              if (!lib) continue
              normalized.push(
                normalizeEvent(
                  raw,
                  cred.provider,
                  cred.id,
                  lib.id,
                  lib.entityRef,
                  provider.eventTypeMap,
                  false
                )
              )
            } else {
              const venueName = raw.venueName ?? raw.title
              const { result, library } = matchVenueToLibrary(
                venueName,
                cred.libraries
              )
              if (result === "none" || !library) continue
              const pending = result === "review"
              if (pending) credPendingReview++
              normalized.push(
                normalizeEvent(
                  raw,
                  cred.provider,
                  cred.id,
                  library.id,
                  library.entityRef,
                  provider.eventTypeMap,
                  pending
                )
              )
            }
          }

          // Step 6: upsert
          const stats = await upsertEvents(normalized)
          pb.created += stats.created
          pb.updated += stats.updated

          totalCreated += stats.created
          totalUpdated += stats.updated
          totalUnchanged += stats.unchanged
          totalPendingReview += credPendingReview

          await updateCredentialStatus(cred.id, "ok")
          await updateRunProgress(runId, {
            eventsFetched: totalFetched,
            eventsCreated: totalCreated,
            eventsUpdated: totalUpdated,
            eventsUnchanged: totalUnchanged,
            eventsPendingReview: totalPendingReview,
            errorCount,
          })
        })
      )
    )

    // Step 7: purge expired
    const purged = await purgeExpiredEvents()

    // Step 8: write final run record
    const completedAt = new Date()
    const status =
      errorCount === 0 ? "success" : valid.length === 0 ? "failed" : "partial"
    await finaliseRunRecord({
      runId,
      triggeredBy,
      triggeredByUserId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      status,
      credentialsTotal: all.length,
      credentialsAttempted: valid.length,
      credentialsFailed: failed.length,
      eventsFetched: totalFetched,
      eventsCreated: totalCreated,
      eventsUpdated: totalUpdated,
      eventsUnchanged: totalUnchanged,
      eventsExpiredPurged: purged,
      eventsPendingReview: totalPendingReview,
      errorCount,
      providerBreakdown,
      failedCredentials,
    })
    console.log(
      `[sync] Run ${runId} complete — ${status}. Created: ${totalCreated}, Updated: ${totalUpdated}, Purged: ${purged}`
    )
  } catch (err: any) {
    console.error(`[sync] Run ${runId} failed fatally:`, err)
    await finaliseRunRecord({
      runId,
      triggeredBy,
      triggeredByUserId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      status: "failed",
      credentialsTotal: 0,
      credentialsAttempted: 0,
      credentialsFailed: 0,
      eventsFetched: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsExpiredPurged: 0,
      eventsPendingReview: 0,
      errorCount: 1,
      providerBreakdown: {},
      failedCredentials: [],
    })
  }
}
