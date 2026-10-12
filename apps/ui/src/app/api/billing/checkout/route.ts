import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { createManagedCheckout } from "@/lib/billing/checkout"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"

export const runtime = "nodejs"
const Choice = z
  .object({
    plan: z.enum(["pro", "supporter"]),
    interval: z.enum(["month", "year"]),
    locale: z.enum(["en", "cs", "fr"]),
    termsVersion: z.string(),
  })
  .strict()

export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    const body = await readBillingJson(req)
    const parsed = Choice.safeParse(body)
    if (!parsed.success) throw new BillingError("invalid_checkout_request", 400)
    if (
      user.planSource &&
      user.planSource !== "paid" &&
      ["pro", "team"].includes(user.plan ?? "") &&
      parsed.data.plan === "pro"
    )
      throw new BillingError("complimentary_pro_available", 409)

    return billingJson(
      await createManagedCheckout(
        authDbPool,
        billingStripe(),
        user,
        parsed.data
      )
    )
  } catch (error) {
    return billingFailure(error)
  }
}
