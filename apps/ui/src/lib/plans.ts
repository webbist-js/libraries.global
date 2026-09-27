/**
 * The one source of plan copy and prices for the /pro page, the Atlas plans
 * sheet and the account menu. Amounts are display strings only and are
 * placeholders until the owner confirms them (pricing spec, 2026-09-27); P-D
 * swaps them for Stripe prices. No other code may hard-code an amount.
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

export type PlanCard = {
  key: PlanCardKey
  name: string
  price: PlanPrice
  who: string
  includes: string[]
  cta: PlanCta
}

export const PRICES_ARE_PLACEHOLDERS = true

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
  "catalogue.editions": {
    label: "Catalogue checks across every edition",
    status: "soon",
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

/** A plan's features, read from the resolver so the copy can't drift from it. */
function featuresOf(plan: "pro" | "team"): Feature[] {
  const { features } = resolveEntitlements({
    signedIn: true,
    now: new Date(0),
    grants: [{ plan, expiresAt: null }],
  })

  return FEATURES.filter((f) => features.has(f))
}

/** Live features first, listed plainly; the rest flagged "(coming soon)". */
function featureLines(features: readonly Feature[]): string[] {
  const live = features.filter((f) => PRO_FEATURE_COPY[f].status === "live")
  const soon = features.filter((f) => PRO_FEATURE_COPY[f].status === "soon")

  return [
    ...live.map((f) => PRO_FEATURE_COPY[f].label),
    ...soon.map((f) => `${PRO_FEATURE_COPY[f].label} (coming soon)`),
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
    who: "Anyone",
    includes: [
      "Every library record, with hours and services",
      "Search, the map and lists",
      "Open-data downloads",
    ],
    cta: { kind: "none", label: "No account needed" },
  },
  {
    key: "free",
    name: "Free account",
    price: "free",
    who: "Anyone who signs up",
    includes: [
      "Everything in Public",
      "Contribute corrections, photos and new libraries",
      "Follow libraries and save events",
      "3 saved views and 3 saved searches (coming soon)",
      "A weekly digest of followed libraries (coming soon)",
    ],
    cta: {
      kind: "signup",
      label: "Create a free account",
      href: "/auth/register?callbackUrl=/pro",
    },
  },
  {
    key: "supporter",
    name: "Supporter",
    price: { monthly: "£3/month", yearly: "£30/year" },
    who: "People who value the index and want to keep it running",
    includes: [
      "Everything in Free",
      "An optional Supporter mark you can hide",
      "Credit on the supporters page",
      "No extra features and no extra trust: it’s patronage",
    ],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "pro",
    name: "Pro",
    price: {
      monthly: "£5/month",
      yearly: "£50/year",
      note: "Founding price, held while your membership continues. Standard £8/month or £80/year once per-capita and Reach ship.",
    },
    who: "Researchers, journalists, consultants, enthusiasts",
    includes: ["Everything in Supporter", ...featureLines(PRO_ONLY)],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "team",
    name: "Team",
    price: {
      yearly: "£480/year ex VAT",
      note: "5 seats; £96 per extra seat. Public library services get 20% off.",
    },
    who: "Library services, councils, universities, consultancies",
    includes: [
      "Pro for every seat",
      "Invoiced yearly; we set up your seats",
      ...featureLines(TEAM_ONLY),
    ],
    cta: { kind: "contact", label: "Talk to us", href: TEAM_CONTACT_HREF },
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
