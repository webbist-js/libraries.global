import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { readBillingJson } from "@/lib/billing/request-body"
import { invalidateSessionProfile } from "@/lib/session-profile"
import { createSelfServiceTeam } from "@/lib/team-billing/billing"

export const runtime = "nodejs"
const Signup = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    publicServiceRequested: z.boolean().optional(),
  })
  .strict()

export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    const parsed = Signup.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_team_signup", 400)
    const result = await createSelfServiceTeam(authDbPool, user, parsed.data)
    invalidateSessionProfile(user.id)

    return billingJson(result, 201)
  } catch (error) {
    return billingFailure(error)
  }
}
