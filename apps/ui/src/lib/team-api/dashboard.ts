import "server-only"

import type { Pool } from "pg"

import { billingStripe } from "@/lib/billing/provider"
import type { TeamDetail } from "@/lib/staff/types"

import { apiPrice } from "./billing"
import { apiAccessActive, apiConfig } from "./config"
import { invoiceLines, overageUnits } from "./ledger"
import { currentPeriod } from "./period"
import { apiSubscription, apiUsage, apiWarnings } from "./store"
import { teamActive } from "./team"
import type {
  ApiDashboard,
  ApiMembership,
  ApiProspect,
  ApiWarning,
} from "./types"

export async function apiPriceView() {
  const config = apiConfig()
  if (!config.purchasing) return null

  return apiPrice(billingStripe())
    .then((p) => ({ unitAmount: p.unit_amount!, currency: p.currency }))
    .catch(() => null)
}

/** Offer details for a signed-in account that has no organisation yet. */
export async function apiProspect(verified: boolean): Promise<ApiProspect> {
  const config = apiConfig()
  const price = await apiPriceView()

  return {
    purchasing: config.purchasing && Boolean(price),
    price,
    limits: config.limits,
    rates: config.rates,
    verified,
  }
}

export async function apiDashboard(
  pool: Pool,
  team: TeamDetail,
  keyOffset = 0
): Promise<ApiDashboard> {
  const config = apiConfig()
  const now = new Date()
  const [subscription, account, attempts, price] = await Promise.all([
    apiSubscription(pool, team.documentId),
    pool.query<{
      overage_enabled: boolean
      overage_cap_pence: number
      overage_revision: number
      overage_updated_at: Date | null
    }>(
      "select overage_enabled,overage_cap_pence,overage_revision,overage_updated_at from api_accounts where team_id=$1",
      [team.documentId]
    ),
    pool.query(
      "select 1 from api_attempts where team_id=$1 and state in ('preparing','open') limit 1",
      [team.documentId]
    ),
    apiPriceView(),
  ])
  const membership: ApiMembership | null = subscription?.membership ?? null
  const active: boolean = apiAccessActive(membership, now)
  const period = active ? currentPeriod(membership, now) : null
  const [usage, warningRows] = await Promise.all([
    apiUsage(pool, team.documentId, period?.start ?? null, keyOffset),
    period ? apiWarnings(pool, team.documentId, period.start) : [],
  ])
  const limits = active && membership ? membership.offer.limits : config.limits
  const rates =
    active && membership ? membership.offer.overageRates : config.rates
  const settings = account.rows[0]
  const accrued = invoiceLines(overageUnits(usage.settled, limits), rates)

  return {
    teamId: team.documentId,
    teamName: team.name,
    organiser: team.viewerRole === "organiser",
    teamActive: teamActive(team),
    membership,
    active: teamActive(team) && active,
    purchasing: config.purchasing && Boolean(price),
    overageAvailable:
      config.overage &&
      Boolean(membership?.offer.overagePrices.requests) &&
      Boolean(membership?.offer.overagePrices.bytes) &&
      Boolean(membership?.offer.overagePrices.credits),
    price,
    limits,
    rates,
    overage: {
      enabled: settings?.overage_enabled ?? false,
      capPence: settings?.overage_cap_pence ?? 0,
      revision: settings?.overage_revision ?? 0,
      updatedAt: settings?.overage_updated_at?.toISOString() ?? null,
    },
    usage: {
      ...usage.totals,
      resetsAt: period?.end ?? null,
      periodStart: period?.start ?? null,
    },
    accrued,
    projectedInvoicePence: !active
      ? null
      : membership && !membership.cancelAtPeriodEnd
        ? membership.unitAmount + accrued.totalPence
        : accrued.totalPence,
    keys: usage.keys,
    keyPage: usage.keyPage,
    days: usage.days,
    endpoints: usage.endpoints,
    warnings: warningRows.filter(
      (w): w is ApiWarning =>
        ["requests", "bytes", "credits", "cap"].includes(w.dimension) &&
        [50, 80, 100].includes(w.threshold)
    ) as ApiWarning[],
    pendingPayment: Boolean(
      attempts.rowCount ||
      (membership &&
        !active &&
        ["active", "incomplete", "past_due"].includes(membership.status) &&
        !membership.revoked)
    ),
  }
}
