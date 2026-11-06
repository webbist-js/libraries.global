import { z } from "zod"

import { BillingError } from "@/lib/billing/config"
import { billingFailure, billingJson, billingUser } from "@/lib/billing/http"
import { readBillingJson } from "@/lib/billing/request-body"
import { createApiOrganisation } from "@/lib/team-api/cms"

export const runtime = "nodejs"
const Signup = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    primaryNetworkId: z
      .string()
      .regex(/^[a-z0-9]{20,32}$/)
      .optional(),
    libraryDocumentIds: z
      .array(z.string().regex(/^[a-z0-9]{20,32}$/))
      .max(2000)
      .optional(),
  })
  .strip()

/**
 * Create a free organisation (staff workspace container) with the caller as
 * organiser. No seats are bought and no payment state exists; library
 * assignments remain claims until verified authority is reviewed.
 */
export async function POST(req: Request) {
  try {
    const user = await billingUser(req, true)
    const parsed = Signup.safeParse(await readBillingJson(req))
    if (!parsed.success) throw new BillingError("invalid_team_signup", 400)
    const teamId = await createApiOrganisation({
      requestId: parsed.data.requestId,
      user,
      name: parsed.data.name,
      primaryNetworkId: parsed.data.primaryNetworkId,
      libraryDocumentIds: parsed.data.libraryDocumentIds,
    })

    return billingJson({ teamId }, 201)
  } catch (error) {
    return billingFailure(error)
  }
}
