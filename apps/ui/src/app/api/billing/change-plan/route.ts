import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { createPlanChangePortal } from "@/lib/billing/plan-change"
import { billingStripe } from "@/lib/billing/provider"
import { readBillingJson } from "@/lib/billing/request-body"

export const runtime = "nodejs"
const choice = z
  .object({
    plan: z.enum(["pro", "supporter"]),
    interval: z.enum(["month", "year"]),
    locale: z.enum(["en", "cs", "fr"]),
  })
  .strict()

export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    const parsed = choice.safeParse(await readBillingJson(req))
    if (!parsed.success)
      throw new BillingError("invalid_membership_choice", 400)

    return billingJson(
      await createPlanChangePortal(authDbPool, billingStripe(), user.id, {
        ...parsed.data,
        complimentaryPro:
          ["pro", "team"].includes(user.plan ?? "") &&
          user.planSource !== "paid",
      })
    )
  } catch (error) {
    return billingFailure(error)
  }
}
