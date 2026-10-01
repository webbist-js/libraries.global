/**
 * The one source of plan copy and prices for the Membership page
 * (/contribute/membership), the Atlas plans sheet and the account menu.
 * Amounts are display strings only and are placeholders until the owner
 * confirms them (pricing spec, 2026-09-27); P-D swaps them for Stripe prices.
 * No other code may hard-code an amount.
 */
import { type Feature, FEATURES, resolveEntitlements } from "@repo/access"

import { CONTACT_EMAIL } from "./constants"

export type PlanCardKey = "public" | "free" | "supporter" | "pro" | "team"

export type PlanPrice =
  | { monthly?: string; yearly?: string; note?: string }
  | "free"

export type PlanCta = {
  kind: "none" | "signup" | "soon" | "contact"
  label: string
  href?: string
}

/**
 * One line of a plan's list. "feature" is built; "soon" isn't yet, and its
 * text says "(coming soon)" so it reads honestly anywhere; "note" is context
 * rather than something the plan includes.
 */
export type PlanInclude = { text: string; kind: "feature" | "soon" | "note" }

export type PlanCard = {
  key: PlanCardKey
  name: string
  price: PlanPrice
  who: string
  includes: PlanInclude[]
  cta: PlanCta
}

export const PRICES_ARE_PLACEHOLDERS = true

/** Pro's price after the founding offer, for the placeholders footnote. */
export const PRO_STANDARD_PRICE_NOTE =
  "Pro’s standard price will be £8/month or £80/year once per-capita layers and Reach ship; founding members keep £5."

/** What each feature does, and whether it's built. Only built ones are "live". */
export const PRO_FEATURE_COPY: Record<
  Feature,
  { label: string; status: "live" | "soon" }
> = {
  "atlas.export": {
    label: "Export Atlas results as CSV or GeoJSON",
    status: "live",
  },
  "atlas.contextLayers": {
    label: "Per-capita, deprivation and transit layers",
    status: "soon",
  },
  "atlas.analysis": {
    label: "Reach, draw-to-analyse and coverage gaps",
    status: "soon",
  },
  "atlas.compare": { label: "Compare two areas", status: "soon" },
  "index.export": {
    label: "Export search results with attribution",
    status: "soon",
  },
  "index.alerts": { label: "Alerts on saved searches", status: "soon" },
  "index.compare": {
    label: "Compare up to six libraries side by side",
    status: "soon",
  },
  "library.watch": {
    label: "Watch a library for changes and closures",
    status: "soon",
  },
  "library.notes": { label: "Private notes on any library", status: "soon" },
  "library.history": {
    label: "See every change to a library, field by field",
    status: "live",
  },
  "data.benchmark": {
    label: "Benchmark a service against similar ones",
    status: "soon",
  },
  "data.explorerExport": { label: "Export derived metrics", status: "soon" },
  "events.personalFeed": {
    label: "A personal calendar feed",
    status: "soon",
  },
  "team.workspace": { label: "A shared service workspace", status: "soon" },
  "team.bulkUpload": {
    label: "Bulk updates from a spreadsheet",
    status: "soon",
  },
  "team.embed": { label: "An embeddable library finder", status: "soon" },
  "api.key": { label: "Higher API quotas", status: "soon" },
}

/**
 * The line under a library's Changes list when values are hidden: the
 * field names are public, previous → next is Pro (`library.history`).
 */
export const LIBRARY_HISTORY_UPGRADE = {
  text: "See what changed, field by field, with Pro.",
  href: "/contribute/membership",
} as const

/** A plan's features, read from the resolver so the copy can't drift from it. */
export function featuresOf(plan: "pro" | "team"): Feature[] {
  const { features } = resolveEntitlements({
    signedIn: true,
    now: new Date(0),
    grants: [{ plan, expiresAt: null }],
  })

  return FEATURES.filter((f) => features.has(f))
}

const feature = (text: string): PlanInclude => ({ text, kind: "feature" })
const soon = (text: string): PlanInclude => ({
  text: `${text} (coming soon)`,
  kind: "soon",
})
const note = (text: string): PlanInclude => ({ text, kind: "note" })

/** Live features first, listed plainly; the rest flagged "(coming soon)". */
function featureItems(features: readonly Feature[]): PlanInclude[] {
  const copy = features.map((f) => PRO_FEATURE_COPY[f])

  return [
    ...copy.filter((c) => c.status === "live").map((c) => feature(c.label)),
    ...copy.filter((c) => c.status === "soon").map((c) => soon(c.label)),
  ]
}

const PRO_ONLY = featuresOf("pro")
const TEAM_ONLY = featuresOf("team").filter((f) => !PRO_ONLY.includes(f))

export const TEAM_CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=Team%20plan`

export const PLANS: readonly PlanCard[] = [
  {
    key: "public",
    name: "Public",
    price: "free",
    who: "Anyone, no account needed",
    includes: [
      feature("Every library record, with hours and services"),
      feature("Search, the map and lists"),
      soon("Open-data downloads"),
    ],
    cta: { kind: "none", label: "No account needed" },
  },
  {
    key: "free",
    name: "Free account",
    price: "free",
    who: "Anyone who signs up",
    includes: [
      feature("Everything in Public"),
      feature("Contribute corrections, photos and new libraries"),
      feature("Follow libraries and save events"),
      soon("3 saved views and 3 saved searches"),
      soon("A weekly digest of followed libraries"),
    ],
    cta: {
      kind: "signup",
      label: "Create a free account",
      href: "/auth/register?callbackUrl=/contribute/membership",
    },
  },
  {
    key: "supporter",
    name: "Supporter",
    price: { monthly: "£3/month", yearly: "£30/year" },
    who: "People who value the index and want to keep it running",
    includes: [
      feature("Everything in Free account"),
      feature("An optional Supporter mark you can hide"),
      feature("Credit on the supporters page"),
      note("No extra features and no extra trust: it’s patronage."),
    ],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "pro",
    name: "Pro",
    price: {
      monthly: "£5/month",
      yearly: "£50/year",
      note: "Founding price, held while you stay a member.",
    },
    who: "Researchers, journalists, consultants, enthusiasts",
    includes: [feature("Everything in Supporter"), ...featureItems(PRO_ONLY)],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "team",
    name: "Team",
    price: {
      yearly: "£480/year ex VAT",
      note: "Includes 5 seats; £96 per extra seat. Public library services get 20% off.",
    },
    who: "Library services, councils, universities, consultancies",
    includes: [
      feature("Pro for every seat"),
      feature("Invoiced yearly; we set up your seats"),
      ...featureItems(TEAM_ONLY),
    ],
    cta: { kind: "contact", label: "Talk to us", href: TEAM_CONTACT_HREF },
  },
]

/**
 * The homepage's short take on each plan: a one-line "who pays" and a
 * sentence on what it's for. Kept here so homepage copy can't drift from
 * the Membership page, and honest about what's built today.
 */
export const PLAN_TEASERS: readonly {
  key: Exclude<PlanCardKey, "supporter">
  tagline: string
  summary: string
}[] = [
  {
    key: "public",
    tagline: "Free, no account",
    summary: "Search, browse and read every library record.",
  },
  {
    key: "free",
    tagline: "Free",
    summary: "Contribute, follow libraries and switch on more atlas layers.",
  },
  {
    key: "pro",
    tagline: "Free for regular contributors",
    summary: "Atlas export today, with reach and coverage analysis on the way.",
  },
  {
    key: "team",
    tagline: "For library services",
    summary:
      "Pro for every seat, invoiced yearly, with shared workspaces to come.",
  },
]

export function planCard(key: PlanCardKey): PlanCard {
  return PLANS.find((p) => p.key === key)!
}

/**
 * Whether a card shows its call to action, given the viewer's plan key
 * ("public" or undefined for a visitor). Members never see a sign-up prompt,
 * and a plan they already hold shows no "coming soon". "Talk to us" stays,
 * since a Team may want more seats.
 */
export function showPlanCta(
  card: PlanCard,
  currentPlan: string | undefined
): boolean {
  const signedIn = currentPlan !== undefined && currentPlan !== "public"
  if (card.cta.kind === "signup" && signedIn) return false

  return card.key !== currentPlan || card.cta.kind === "contact"
}

/** The one-line price: "Free", else the monthly price, else the yearly one. */
export function priceHeadline(price: PlanPrice): string {
  if (price === "free") return "Free"

  return price.monthly ?? price.yearly ?? ""
}

/**
 * One line on how the member holds their plan, or null when there's nothing
 * to say (free, public, or a value we don't recognise).
 */
export function planStatusCopy(
  plan: string | null | undefined,
  planSource: string | null | undefined
): string | null {
  const name = plan === "pro" ? "Pro" : plan === "team" ? "Team" : null
  if (!name) return null

  switch (planSource) {
    case "grant":
      return `You have ${name}, granted by the libraries.global team.`
    case "earned":
      return `You have ${name} for your contributions (Archivist tier).`
    case "verified":
      return `You have ${name} as verified library staff, student or charity.`
    case "paid":
      return `You're on ${name}.`

    default:
      return null
  }
}
