import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { z } from "zod"

import { sessionTeamsOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"
import { apiCheckout, organisationRequestId } from "@/lib/team-api/billing"
import { createApiOrganisation } from "@/lib/team-api/cms"
import { apiConfig } from "@/lib/team-api/config"
import { API_TERMS_VERSION } from "@/lib/team-api/constants"
import { requireApiTeam } from "@/lib/team-api/team"

export const runtime = "nodejs"

const Checkout = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    termsVersion: z.string().max(40),
    /** Name for a new single-member organisation; defaults to the account name. */
    organisationName: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

/**
 * Individual API checkout. A buyer without an organisation gets a free
 * single-member organisation with them as organiser, then the same
 * organisation-owned checkout as organisers use. Members of an existing
 * organisation must ask an organiser.
 */
export async function POST(req: Request) {
  try {
    const parsed = Checkout.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_api_action", 400)
    if (parsed.data.termsVersion !== API_TERMS_VERSION)
      throw new BillingError("api_terms_required", 400)
    const user = await billingUser(req, true, true)
    if (!apiConfig().purchasing)
      throw new BillingError("api_purchases_unavailable", 409)
    const teams = sessionTeamsOf(user)
    if (teams.length > 1) throw new BillingError("organisation_conflict", 409)
    const teamId =
      teams[0]?.id ??
      (await createApiOrganisation({
        requestId: organisationRequestId(user.id),
        user,
        name: parsed.data.organisationName ?? (user.name?.trim() || user.email),
      }))
    const team = await requireApiTeam(teamId, user, true, true)

    return billingJson(
      await apiCheckout(authDbPool, billingStripe(), team, user, parsed.data)
    )
  } catch (error) {
    return billingFailure(error)
  }
}
