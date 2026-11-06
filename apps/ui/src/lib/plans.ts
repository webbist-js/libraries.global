/**
 * The offers shown on the plans page (/plans), the Atlas plans sheet, the
 * homepage and the profile standing section: Explorer, Contributor (with the
 * earned Supporter milestone), Verified Staff, API Access and Sponsor.
 *
 * This file holds structure and numbers only. Copy lives in the
 * `membershipContent` messages, keyed by the ids here. Allowances come from
 * the access resolver (`@repo/access`) and amounts from
 * `membership-pricing.json`, so the pages can never promise more than the
 * code grants. No other code may hard-code a price or allowance.
 *
 * Payment, sponsorship and recognition never grant editing authority,
 * staff verification, ranking or editorial treatment.
 */
import {
  type AccessStanding,
  API_REACH_PER_DAY,
  API_REACH_PER_HOUR,
  API_REACH_SERVICE_LIBRARIES,
  CONTRIBUTION_ACTIVITY_DAYS,
  CONTRIBUTOR_MIN_ACCEPTED,
  CONTRIBUTOR_REACH_PER_WEEK,
  EXPLORER_LIMITS,
  type Feature,
  recognitionOf,
  SUPPORTER_MIN_ACCEPTED,
} from "@repo/access"

import pricing from "./membership-pricing.json"

export type OfferKey = "explorer" | "contributor" | "staff" | "api" | "sponsor"

export const OFFER_KEYS: readonly OfferKey[] = [
  "explorer",
  "contributor",
  "staff",
  "api",
  "sponsor",
]

/**
 * One line of an offer's list, by message id. "live" is built; "soon" is
 * planned and shows a chip; "note" is context rather than something the
 * offer includes.
 */
export type OfferItem = { id: string; status: "live" | "soon" | "note" }

export type OfferPrice =
  | { kind: "free" }
  /** Free, unlocked by accepted contributions. */
  | { kind: "earned" }
  | { kind: "monthly"; pence: number; taxInclusive: true }
  /** Annual sponsorship, quoted from the lowest suggested anchor. */
  | { kind: "yearFrom"; pence: number }

export type Offer = {
  key: OfferKey
  icon: string
  price: OfferPrice
  items: readonly OfferItem[]
  cta: { id: string; href: string }
}

const live = (id: string): OfferItem => ({ id, status: "live" })
const soon = (id: string): OfferItem => ({ id, status: "soon" })
const note = (id: string): OfferItem => ({ id, status: "note" })

/** The £100 API offer, as sold. */
export const API_OFFER = {
  monthPence: pricing.api.month,
  requests: pricing.api.included.requests,
  bytes: pricing.api.included.bytes,
  mib: pricing.api.included.bytes / 1024 ** 2,
  analysisCredits: pricing.api.included.analysisCredits,
  overage: {
    requestPence: pricing.api.overage.requestPence,
    mibPence: pricing.api.overage.mibPence,
    creditPence: pricing.api.overage.creditPence,
    capMinPence: pricing.api.overage.capMinPence,
    capMaxPence: pricing.api.overage.capMaxPence,
    capDefaultPence: pricing.api.overage.capDefaultPence,
  },
} as const

export type SponsorTier = "community" | "service" | "founding"

/** Suggested annual amounts for a sponsorship conversation, not entitlements. */
export const SPONSOR_TIERS: readonly { key: SponsorTier; yearPence: number }[] =
  [
    { key: "community", yearPence: pricing.sponsor.community },
    { key: "service", yearPence: pricing.sponsor.service },
    { key: "founding", yearPence: pricing.sponsor.founding },
  ]

/** Recognition thresholds and the Contributor Reach allowance. */
export const RECOGNITION = {
  contributorAt: CONTRIBUTOR_MIN_ACCEPTED,
  supporterAt: SUPPORTER_MIN_ACCEPTED,
  activityDays: CONTRIBUTION_ACTIVITY_DAYS,
  reachPerWeek: CONTRIBUTOR_REACH_PER_WEEK,
} as const

/** Explorer's fair-use limits, from the resolver. */
export const EXPLORER_ALLOWANCES = {
  savedViews: EXPLORER_LIMITS.savedViews,
  exportRows: EXPLORER_LIMITS.exportRows,
  exportsPerDay: EXPLORER_LIMITS.exportsPerDay,
} as const

/** The browser Reach bonus for organisers of a covered API account. */
export const API_REACH = {
  perHour: API_REACH_PER_HOUR,
  perDay: API_REACH_PER_DAY,
  serviceLibraries: API_REACH_SERVICE_LIBRARIES,
} as const

export const OFFERS: readonly Offer[] = [
  {
    key: "explorer",
    icon: "mdi:compass-outline",
    price: { kind: "free" },
    items: [
      live("records"),
      live("contribute"),
      live("follow"),
      live("contextLayers"),
      live("libraryAccess"),
      live("history"),
      live("savedViews"),
      live("export"),
      soon("alerts"),
      soon("notes"),
    ],
    cta: { id: "signUp", href: "/auth/register?callbackUrl=/plans" },
  },
  {
    key: "contributor",
    icon: "mdi:hand-heart-outline",
    price: { kind: "earned" },
    items: [
      live("everythingExplorer"),
      live("reach"),
      live("credit"),
      live("supporter"),
      note("noAuthority"),
    ],
    cta: { id: "contribute", href: "/contribute" },
  },
  {
    key: "staff",
    icon: "mdi:bank-outline",
    price: { kind: "free" },
    items: [
      live("workspace"),
      live("editing"),
      live("organisation"),
      live("widgets"),
      soon("traffic"),
      note("scope"),
    ],
    cta: { id: "claim", href: "/contribute/claim" },
  },
  {
    key: "api",
    icon: "mdi:code-braces",
    price: { kind: "monthly", pence: API_OFFER.monthPence, taxInclusive: true },
    items: [
      live("allowance"),
      live("keys"),
      live("overage"),
      live("reach"),
      live("noOrganisation"),
      note("noAuthority"),
    ],
    cta: { id: "developers", href: "/developers" },
  },
  {
    key: "sponsor",
    icon: "mdi:handshake-outline",
    price: { kind: "yearFrom", pence: SPONSOR_TIERS[0]!.yearPence },
    items: [
      live("programmes"),
      live("reporting"),
      live("acknowledgement"),
      note("independence"),
    ],
    cta: { id: "sponsor", href: "/sponsor" },
  },
]

export function offer(key: OfferKey): Offer {
  return OFFERS.find((o) => o.key === key)!
}

/**
 * Numbers every offer, comparison and FAQ message may interpolate, so the
 * copy follows the resolver and pricing file. Money is formatted per locale.
 */
export function offerValues(locale: string) {
  const money = (pence: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: pricing.currency.toUpperCase(),
      maximumFractionDigits: pence % 100 === 0 ? 0 : 2,
      minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
    }).format(pence / 100)
  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const sponsor = Object.fromEntries(
    SPONSOR_TIERS.map((tier) => [`${tier.key}Price`, money(tier.yearPence)])
  ) as Record<`${SponsorTier}Price`, string>

  return {
    savedViews: count(EXPLORER_ALLOWANCES.savedViews),
    exportRows: count(EXPLORER_ALLOWANCES.exportRows),
    exportsPerDay: EXPLORER_ALLOWANCES.exportsPerDay,
    reachPerWeek: RECOGNITION.reachPerWeek,
    contributorAt: RECOGNITION.contributorAt,
    supporterAt: RECOGNITION.supporterAt,
    activityDays: RECOGNITION.activityDays,
    apiPrice: money(API_OFFER.monthPence),
    apiRequests: count(API_OFFER.requests),
    apiMib: count(API_OFFER.mib),
    apiCredits: count(API_OFFER.analysisCredits),
    requestPrice: money(API_OFFER.overage.requestPence),
    mibPrice: money(API_OFFER.overage.mibPence),
    creditPrice: money(API_OFFER.overage.creditPence),
    capMin: money(API_OFFER.overage.capMinPence),
    capMax: money(API_OFFER.overage.capMaxPence),
    capDefault: money(API_OFFER.overage.capDefaultPence),
    apiReachPerHour: API_REACH.perHour,
    apiReachPerDay: API_REACH.perDay,
    apiReachLibraries: API_REACH.serviceLibraries,
    ...sponsor,
  }
}

export type OfferValues = ReturnType<typeof offerValues>

/** The status of each Explorer-or-better tool: only "live" ones are built. */
export const FEATURE_STATUS: Record<Feature, "live" | "soon"> = {
  "atlas.contextLayers": "live",
  "atlas.analysis": "live",
  "atlas.export": "live",
  "atlas.compare": "live",
  "atlas.reach": "live",
  "atlas.serviceReach": "live",
  "index.export": "soon",
  "index.alerts": "soon",
  "index.compare": "soon",
  "library.watch": "soon",
  "library.notes": "soon",
  "library.history": "live",
  "data.benchmark": "soon",
  "data.explorerExport": "soon",
  "events.personalFeed": "soon",
  "api.key": "live",
}

/**
 * The line under a library's Changes list when values are hidden: field
 * names are public, previous → next needs a signed-in (Explorer) account.
 */
export const LIBRARY_HISTORY_UPGRADE = {
  text: "Sign in to see what changed, field by field. It's free.",
  href: "/auth/signin",
} as const

export type StandingProgress = {
  /** Earned standing for display; "public" only for a signed-out viewer. */
  standing: AccessStanding
  accepted: number
  /** The next milestone, or null once Supporter is reached. */
  next: { standing: "contributor" | "supporter"; at: number } | null
  /** Accepted contributions still needed for the next milestone. */
  remaining: number
  /** Progress towards Supporter, 0–100, rounded down. */
  percent: number
}

/**
 * Where an account stands on the way to Supporter. Recognition is counted
 * from accepted contributions, never points or payment, and a moderator's
 * revocation resets it to Explorer.
 */
export function standingProgress(input: {
  signedIn: boolean
  acceptedContributions?: number | null
  recognitionRevoked?: boolean | null
}): StandingProgress {
  const accepted =
    Number.isSafeInteger(input.acceptedContributions) &&
    (input.acceptedContributions as number) > 0
      ? (input.acceptedContributions as number)
      : 0
  if (!input.signedIn)
    return {
      standing: "public",
      accepted: 0,
      next: { standing: "contributor", at: RECOGNITION.contributorAt },
      remaining: RECOGNITION.contributorAt,
      percent: 0,
    }
  const recognition = recognitionOf(input)
  const standing: AccessStanding =
    recognition === "none" ? "explorer" : recognition
  const next =
    standing === "supporter"
      ? null
      : standing === "contributor"
        ? { standing: "supporter" as const, at: RECOGNITION.supporterAt }
        : { standing: "contributor" as const, at: RECOGNITION.contributorAt }
  const counted = input.recognitionRevoked ? 0 : accepted

  return {
    standing,
    accepted: counted,
    next,
    remaining: next ? Math.max(0, next.at - counted) : 0,
    percent: Math.min(
      100,
      Math.floor((counted / RECOGNITION.supporterAt) * 100)
    ),
  }
}

/** The standing's message key under `membershipContent.standing`. */
export function standingName(
  standing: AccessStanding | string | null | undefined
) {
  return standing === "supporter" ||
    standing === "contributor" ||
    standing === "explorer"
    ? standing
    : "public"
}
