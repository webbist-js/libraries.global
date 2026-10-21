import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"
import { requireApiTeam } from "@/lib/team-api/team"
import { teamCheckout, teamPortal } from "@/lib/team-billing/billing"
import { teamBillingDashboard } from "@/lib/team-billing/dashboard"
import { refreshOwnedTeam, discardTeam } from "@/lib/team-billing/manage"
import { MIN_TEAM_SEATS, MAX_TEAM_SEATS } from "@/lib/team-billing/types"

export const runtime = "nodejs"
type Params = { params: Promise<{ teamId: string }> }
const Action = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("checkout"),
      seats: z.number().int().min(MIN_TEAM_SEATS).max(MAX_TEAM_SEATS),
      locale: z.enum(["en", "fr", "cs"]),
      termsVersion: z.string().max(40),
    })
    .strict(),
  z
    .object({ action: z.literal("portal"), locale: z.enum(["en", "fr", "cs"]) })
    .strict(),
  z.object({ action: z.enum(["refresh", "discard"]) }).strict(),
])

export async function GET(req: Request, { params }: Params) {
  try {
    const user = await billingUser(req)
    const team = await requireApiTeam((await params).teamId, user)

    return billingJson(await teamBillingDashboard(authDbPool, team))
  } catch (error) {
    return billingFailure(error)
  }
}
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await billingUser(req, true)
    const { teamId } = await params
    await requireApiTeam(teamId, user, true, false)
    const parsed = Action.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_team_action", 400)
    const action = parsed.data
    const stripe = billingStripe()
    switch (action.action) {
      case "checkout":
        return billingJson(
          await teamCheckout(authDbPool, stripe, teamId, user, action)
        )
      case "portal":
        return billingJson(
          await teamPortal(authDbPool, stripe, teamId, user, action.locale)
        )
      case "refresh":
        await refreshOwnedTeam(authDbPool, stripe, teamId, user)
        break
      case "discard":
        await discardTeam(authDbPool, stripe, teamId, user)

        return billingJson({ discarded: true })
    }

    return billingJson(
      await teamBillingDashboard(authDbPool, await requireApiTeam(teamId, user))
    )
  } catch (error) {
    return billingFailure(error)
  }
}
