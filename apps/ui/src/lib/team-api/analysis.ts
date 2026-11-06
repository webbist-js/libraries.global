import "server-only"

import { authDbPool } from "@/lib/auth"

import {
  refundAnalysisCredits,
  reserveAnalysisCredits,
  settleAnalysisCredits,
  type AnalysisReservation,
} from "./store"

/**
 * Analysis credit reservations for asynchronous jobs.
 *
 * Use a stable job id of at most 80 characters from `[A-Za-z0-9_:.-]` (for
 * example `reach:<uuid>` minted at acceptance) and
 * keep it across retries, worker restarts and result fetches:
 *
 * 1. `reserveAnalysis(accountId, jobId, credits)` at acceptance. Exactly once
 *    per job id: repeating it returns the existing reservation. Throws an
 *    `ApiRefusal` (429 `quota_analysis` or `overage_cap`) before any work when
 *    the worst case cannot fit, or `BillingError("api_access_inactive", 403)`.
 * 2. `settleAnalysis(jobId)` once the result is complete, optionally with
 *    fewer credits (`{ credits }`) when cached work was reused. Records one
 *    immutable usage event and its Stripe meter deliveries.
 * 3. `refundAnalysis(jobId)` on failure, cancellation or expiry.
 *
 * Settle and refund are idempotent and return the job's final state
 * (`"settled"`, `"refunded"`, or null for an unknown job). Whichever runs
 * first wins; a late settle after a refund (including the maintenance refund
 * of reservations older than one hour) charges nothing, so revalidate before
 * delivering a result. Fetching a result consumes request and byte allowance
 * through `withApiRequest`, never a second analysis credit.
 *
 * `accountId` is the API account's organisation (Team) document id, from the
 * authenticated request (`ApiRequestContext.account.teamId`).
 */
export function reserveAnalysis(
  accountId: string,
  jobId: string,
  credits: number
): Promise<AnalysisReservation> {
  return reserveAnalysisCredits(authDbPool, accountId, jobId, credits)
}

export function settleAnalysis(
  jobId: string,
  options: { credits?: number } = {}
): Promise<AnalysisReservation["state"] | null> {
  return settleAnalysisCredits(authDbPool, jobId, options.credits)
}

export function refundAnalysis(
  jobId: string
): Promise<AnalysisReservation["state"] | null> {
  return refundAnalysisCredits(authDbPool, jobId)
}

export type { AnalysisReservation }
