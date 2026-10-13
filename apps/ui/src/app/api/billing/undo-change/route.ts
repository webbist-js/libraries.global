import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { undoPlanChange } from "@/lib/billing/plan-schedule"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"

export const runtime = "nodejs"
export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    if (
      !z
        .object({})
        .strict()
        .safeParse(await readBillingJson(req)).success
    )
      throw new BillingError("invalid_membership_choice", 400)

    return billingJson(
      await undoPlanChange(authDbPool, billingStripe(), user.id)
    )
  } catch (error) {
    return billingFailure(error)
  }
}
