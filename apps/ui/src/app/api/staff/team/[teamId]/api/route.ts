import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"
import { apiCheckout, apiPortal, setApiOverage } from "@/lib/team-api/billing"
import { OVERAGE_CAP_MAX_PENCE } from "@/lib/team-api/constants"
import { apiDashboard } from "@/lib/team-api/dashboard"
import { keyScopes } from "@/lib/team-api/scopes"
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
      /** Omitted means the read scopes only. */
      scopes: z
        .array(z.enum(API_SCOPES))
        .min(1)
        .max(API_SCOPES.length)
        .transform((s) => [...new Set(s)])
        .optional(),
      /** Required for `analysis:run` or `submissions:write`. */
      confirmScopes: z.literal(true).optional(),
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
      locale: z.enum(SUPPORTED_LOCALES),
      termsVersion: z.string().max(40),
    })
    .strict(),
  z
    .object({ action: z.literal("portal"), locale: z.enum(SUPPORTED_LOCALES) })
    .strict(),
  z
    .object({
      action: z.literal("overage"),
      enabled: z.boolean(),
      capPence: z.number().int().min(0).max(OVERAGE_CAP_MAX_PENCE).optional(),
      termsVersion: z.string().max(40).optional(),
      /** The organiser's affirmative opt-in; the UI never sends it by default. */
      confirm: z.literal(true).optional(),
    })
    .strict()
    .refine((v) =>
      v.enabled
        ? v.capPence !== undefined && v.termsVersion !== undefined && v.confirm
        : v.capPence === undefined && v.confirm === undefined
    ),
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

/** Organisers buy and manage; members only read the dashboard (GET). */
export async function POST(req: Request, { params }: Params) {
  try {
    const { teamId } = await params
    const parsed = Action.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_api_action", 400)
    const action = parsed.data
    const fresh =
      ["create", "rotate", "checkout"].includes(action.action) ||
      (action.action === "overage" && action.enabled)
    const user = await billingUser(req, true, fresh)
    // Revocation, billing management and turning overage off stay available
    // while an organisation is inactive, so a leaked key can be contained.
    const needsActiveTeam =
      ["create", "rotate", "checkout"].includes(action.action) ||
      (action.action === "overage" && action.enabled)
    const team = await requireApiTeam(teamId, user, true, needsActiveTeam)
    switch (action.action) {
      case "create":
        return billingJson(
          await createApiKey(authDbPool, teamId, user.id, {
            name: action.name,
            expiresAt: action.expiresAt,
            scopes: keyScopes(action.scopes, action.confirmScopes === true),
          }),
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
      case "overage":
        return billingJson(
          await setApiOverage(
            authDbPool,
            billingStripe(),
            teamId,
            user.id,
            action.enabled
              ? {
                  enabled: true,
                  capPence: action.capPence!,
                  termsVersion: action.termsVersion!,
                }
              : { enabled: false }
          )
        )
    }
  } catch (error) {
    return billingFailure(error)
  }
}
