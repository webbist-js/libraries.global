import "server-only"

import { BillingError } from "@/lib/billing/config"
import { isDocumentIdParam } from "@/lib/bridge-params"

/**
 * Private, service-secret Access plugin routes for API accounts. They never
 * accept a browser identity: the caller is this server, after its own checks.
 */
async function accessBridge<T>(
  path: string,
  body: unknown,
  failure = "api_account_service_unavailable"
): Promise<{ status: number; body: T | null }> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError(failure)
  const response = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/${path}`,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify(body),
    }
  )
  let parsed: T | null = null
  try {
    parsed = (await response.json()) as T
  } catch {
    parsed = null
  }

  return { status: response.status, body: parsed }
}

const errorCode = (body: unknown) =>
  (body as { error?: { code?: unknown } } | null)?.error?.code

/**
 * Create a free single-member organisation for an individual API buyer, with
 * the buyer as its organiser and no seat or payment state. Idempotent by
 * `requestId`. Refused when the account already belongs to an organisation.
 */
export async function createApiOrganisation(input: {
  requestId: string
  user: { id: string; email: string; name?: string | null }
  name: string
  /** Optional staff-workspace setup; assignments remain unverified claims. */
  primaryNetworkId?: string
  libraryDocumentIds?: string[]
}) {
  const result = await accessBridge<{ teamId?: string }>(
    "api/accounts/organisation",
    {
      requestId: input.requestId,
      baUserId: input.user.id,
      email: input.user.email,
      name: input.name.slice(0, 120),
      ...(input.primaryNetworkId
        ? { primaryNetworkId: input.primaryNetworkId }
        : {}),
      ...(input.libraryDocumentIds
        ? { libraryDocumentIds: input.libraryDocumentIds }
        : {}),
    }
  )
  if (result.status === 409)
    throw new BillingError(
      errorCode(result.body) === "team_membership_exists"
        ? "organisation_exists"
        : "organisation_conflict",
      409
    )
  if (result.status === 410) throw new BillingError("profile_required", 409)
  if (result.status === 400) throw new BillingError("invalid_team_signup", 400)
  const teamId = result.body?.teamId
  if (result.status !== 200 || !isDocumentIdParam(teamId ?? ""))
    throw new BillingError("api_account_service_unavailable")

  return teamId!
}

export type OrganiserTeam = {
  teamId: string
  otherOrganisers: number
  otherMembers: number
}

/** Organisations where this account is an active organiser (deletion checks). */
export async function organiserTeams(baUserId: string) {
  const result = await accessBridge<{ teams?: OrganiserTeam[] }>(
    "api/accounts/owner-check",
    { baUserId }
  )
  if (result.status !== 200 || !Array.isArray(result.body?.teams))
    throw new BillingError("api_account_service_unavailable")

  return result.body.teams.filter((t) => isDocumentIdParam(t.teamId))
}

/** Deliver deduplicated usage warnings to the organisation's organisers. */
export async function sendApiWarning(input: {
  teamId: string
  periodStart: string
  dimension: string
  threshold: number
}) {
  const result = await accessBridge(
    `api/teams/${input.teamId}/api-notices`,
    {
      periodStart: input.periodStart,
      dimension: input.dimension,
      threshold: input.threshold,
    },
    "api_notice_unavailable"
  )
  if (result.status !== 200 && result.status !== 404)
    throw new BillingError("api_notice_unavailable")
}
