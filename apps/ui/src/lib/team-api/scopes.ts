import { BillingError } from "@/lib/billing/config"

import { API_CONFIRMED_SCOPES, API_READ_SCOPES } from "./constants"
import type { ApiScope } from "./types"

/**
 * Scopes for a new key. Without a selection a key gets the read scopes only.
 * `analysis:run` (spends credits) and `submissions:write` (creates proposals)
 * need an explicit confirmation in the creation request.
 */
export function keyScopes(
  requested: readonly ApiScope[] | undefined,
  confirmed: boolean
): ApiScope[] {
  const scopes = requested?.length
    ? [...new Set(requested)]
    : [...API_READ_SCOPES]
  if (
    !confirmed &&
    scopes.some((s) => (API_CONFIRMED_SCOPES as readonly string[]).includes(s))
  )
    throw new BillingError("api_scope_confirmation_required", 400)

  return scopes
}
