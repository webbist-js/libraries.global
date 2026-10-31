import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"
import { apiCheckout, apiPortal } from "@/lib/team-api/billing"
import { apiDashboard } from "@/lib/team-api/dashboard"
import { createApiKey, changeApiKey } from "@/lib/team-api/store"
import { requireApiTeam } from "@/lib/team-api/team"
import { API_SCOPES } from "@/lib/team-api/types"

export const runtime = "nodejs"
type Params = { params: Promise<{ teamId: string }> }
const Action = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      name: z.string().trim().min(1).max(80),
      scopes: z
        .array(z.enum(API_SCOPES))
        .min(1)
        .max(API_SCOPES.length)
        .transform((s) => [...new Set(s)]),
      expiresAt: z.iso
        .datetime()
        .nullable()
        .refine(
          (d) =>
            !d ||
            (Date.parse(d) > Date.now() &&
              Date.parse(d) <= Date.now() + 366 * 86_400_000)
        ),
    })
    .strict(),
  z.object({ action: z.enum(["rotate", "revoke"]), keyId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("checkout"),
      locale: z.enum(["en", "fr", "cs"]),
      termsVersion: z.string().max(40),
    })
    .strict(),
  z
    .object({ action: z.literal("portal"), locale: z.enum(["en", "fr", "cs"]) })
    .strict(),
])

export async function GET(req: Request, { params }: Params) {
  try {
    const user = await billingUser(req)
    const { teamId } = await params
    const team = await requireApiTeam(teamId, user)

    const offset = new URL(req.url).searchParams.get("keyOffset") ?? "0"
    if (!/^\d{1,9}$/.test(offset))
      throw new BillingError("invalid_api_action", 400)

    return billingJson(await apiDashboard(authDbPool, team, Number(offset)))
  } catch (error) {
    return billingFailure(error)
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { teamId } = await params
    const parsed = Action.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_api_action", 400)
    const action = parsed.data
    const user = await billingUser(
      req,
      true,
      ["create", "rotate"].includes(action.action)
    )
    const needsActiveTeam =
      action.action !== "revoke" && action.action !== "portal"
    const team = await requireApiTeam(teamId, user, true, needsActiveTeam)
    switch (action.action) {
      case "create":
        return billingJson(
          await createApiKey(authDbPool, teamId, user.id, action),
          201
        )
      case "rotate":
      case "revoke":
        return billingJson(
          await changeApiKey(
            authDbPool,
            teamId,
            user.id,
            action.keyId,
            action.action === "rotate"
          )
        )
      case "checkout":
        return billingJson(
          await apiCheckout(authDbPool, billingStripe(), team, user, action)
        )
      case "portal":
        return billingJson(
          await apiPortal(authDbPool, billingStripe(), teamId, action.locale)
        )
    }
  } catch (error) {
    return billingFailure(error)
  }
}
