// apps/sync-worker/src/pipeline/write-run.ts
import db from "../db"

export interface RunSummary {
  runId: string
  triggeredBy: "cron" | "manual"
  triggeredByUserId?: number
  startedAt: string
  completedAt: string
  durationMs: number
  status: "success" | "partial" | "failed"
  credentialsTotal: number
  credentialsAttempted: number
  credentialsFailed: number
  eventsFetched: number
  eventsCreated: number
  eventsUpdated: number
  eventsUnchanged: number
  eventsExpiredPurged: number
  eventsPendingReview: number
  errorCount: number
  providerBreakdown: Record<string, unknown>
  failedCredentials: {
    credentialId: number
    label: string
    error: string
  }[]
}

export async function createRunRecord(
  runId: string,
  triggeredBy: "cron" | "manual",
  triggeredByUserId?: number
): Promise<void> {
  const now = new Date().toISOString()
  await db("ev_import_runs").insert({
    run_id: runId,
    triggered_by: triggeredBy,
    triggered_by_user_id: triggeredByUserId ?? null,
    started_at: now,
    status: "running",
    credentials_total: 0,
    credentials_attempted: 0,
    credentials_failed: 0,
    events_fetched: 0,
    events_created: 0,
    events_updated: 0,
    events_unchanged: 0,
    events_expired_purged: 0,
    events_pending_review: 0,
    error_count: 0,
    created_at: now,
    updated_at: now,
    published_at: now,
  })
}

export async function updateRunProgress(
  runId: string,
  patch: Partial<{
    credentialsAttempted: number
    credentialsFailed: number
    eventsFetched: number
    eventsCreated: number
    eventsUpdated: number
    eventsUnchanged: number
    eventsPendingReview: number
    errorCount: number
  }>
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.credentialsAttempted != null)
    row.credentials_attempted = patch.credentialsAttempted
  if (patch.credentialsFailed != null)
    row.credentials_failed = patch.credentialsFailed
  if (patch.eventsFetched != null) row.events_fetched = patch.eventsFetched
  if (patch.eventsCreated != null) row.events_created = patch.eventsCreated
  if (patch.eventsUpdated != null) row.events_updated = patch.eventsUpdated
  if (patch.eventsUnchanged != null)
    row.events_unchanged = patch.eventsUnchanged
  if (patch.eventsPendingReview != null)
    row.events_pending_review = patch.eventsPendingReview
  if (patch.errorCount != null) row.error_count = patch.errorCount
  await db("ev_import_runs").where("run_id", runId).update(row)
}

export async function finaliseRunRecord(summary: RunSummary): Promise<void> {
  await db("ev_import_runs")
    .where("run_id", summary.runId)
    .update({
      completed_at: summary.completedAt,
      duration_ms: summary.durationMs,
      status: summary.status,
      credentials_total: summary.credentialsTotal,
      credentials_attempted: summary.credentialsAttempted,
      credentials_failed: summary.credentialsFailed,
      events_fetched: summary.eventsFetched,
      events_created: summary.eventsCreated,
      events_updated: summary.eventsUpdated,
      events_unchanged: summary.eventsUnchanged,
      events_expired_purged: summary.eventsExpiredPurged,
      events_pending_review: summary.eventsPendingReview,
      error_count: summary.errorCount,
      provider_breakdown: JSON.stringify(summary.providerBreakdown),
      failed_credentials: JSON.stringify(summary.failedCredentials),
      notes: `${summary.eventsCreated} new, ${summary.eventsUpdated} updated, ${summary.errorCount} errors`,
      updated_at: new Date().toISOString(),
    })
}

export async function updateCredentialStatus(
  credentialId: number,
  status: "ok" | "error",
  errorMessage?: string
): Promise<void> {
  await db("ev_event_credentials")
    .where("id", credentialId)
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_error_message: status === "error" ? (errorMessage ?? null) : null,
      updated_at: new Date().toISOString(),
    })
}
