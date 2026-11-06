import "server-only"

import { createHmac } from "node:crypto"

import { bonusApiAccountOf, hasFact } from "./access-server"

/**
 * The Reach allowance the private Atlas bridge admits new calculations
 * against. Cached repeats never spend it; Strapi keeps the native area,
 * cell and queue checks.
 *
 * - `contributor`: new one-library calculations per rolling seven days,
 *   keyed on the person.
 * - `api`: the API organiser bonus, hourly per person plus a pooled daily
 *   allowance keyed on the API account.
 */
export type ReachAllowance =
  | { kind: "contributor"; weekly: number }
  | { kind: "api"; hourly: number; daily: number; accountKey: string }

const limitsOf = (user: unknown): Record<string, unknown> => {
  const raw =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).limits
      : null

  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
}

const within = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max

/** The person's opaque key on the bridge (never the account id). */
export function reachUserKey(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`reach:${userId}`).digest("hex")
}

/**
 * The allowance for this session, or null when it has none. Service Reach
 * (`service: true`) takes only the API organiser bonus.
 */
export function reachAllowanceOf(
  user: unknown,
  secret: string,
  { service = false }: { service?: boolean } = {}
): ReachAllowance | null {
  const limits = limitsOf(user)
  const account = hasFact(user, "apiCustomer") ? bonusApiAccountOf(user) : null
  if (
    account &&
    within(limits.analysisRunsPerHour, 100) &&
    within(limits.analysisRunsPerDay, 1000)
  )
    return {
      kind: "api",
      hourly: limits.analysisRunsPerHour,
      daily: limits.analysisRunsPerDay,
      accountKey: createHmac("sha256", secret)
        .update(`reach-account:${account.teamId}`)
        .digest("hex"),
    }
  if (!service && within(limits.reachRunsPerWeek, 10))
    return { kind: "contributor", weekly: limits.reachRunsPerWeek }

  return null
}

const ALLOWANCE_MESSAGES: Record<string, string> = {
  REACH_WEEKLY_LIMIT:
    "Weekly Reach allowance reached. Results already calculated stay free; try again later.",
  REACH_HOURLY_LIMIT: "Hourly analysis allowance reached. Try again later.",
  REACH_DAILY_LIMIT:
    "Daily Reach allowance for this API account reached. Try again tomorrow.",
}

/** The 429 body for an exhausted allowance, from the bridge's stable code. */
export function reachAllowanceError(backend: unknown): {
  error: string
  code: string
} {
  const code =
    backend && typeof backend === "object"
      ? (backend as Record<string, unknown>).code
      : null

  return typeof code === "string" && code in ALLOWANCE_MESSAGES
    ? { error: ALLOWANCE_MESSAGES[code]!, code }
    : {
        error: "Analysis allowance reached. Try again later.",
        code: "REACH_LIMIT",
      }
}
