/**
 * The one source of plan copy and prices for the Membership page
 * (/contribute/membership), the Atlas plans sheet and the account menu.
 * Individual amounts are the agreed tax-inclusive GBP base prices. Checkout
 * reads the owned Stripe catalogue and confirms the actual recurring charge.
 * No other code may hard-code an amount.
 */
import { type Feature, FEATURES, resolveEntitlements } from "@repo/access"

import { CONTACT_EMAIL } from "./constants"

import pricing from "./membership-pricing.json"

const pounds = (pence: number) => `£${pence / 100}`
const publicServiceRate = 1 - pricing.team.publicServiceDiscountPercent / 100

export type PlanCardKey = "public" | "free" | "supporter" | "pro" | "team"
export type DigitalPlanKey = "supporter" | "pro" | "team"

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

export const PRICES_ARE_PLACEHOLDERS = false

export const ATLAS_PER_CAPITA_LABEL =
  "Library access: population comparisons for countries and supported local areas"

/** Pro's price after the founding offer, for the placeholders footnote. */
export const PRO_STANDARD_PRICE_NOTE = `Pro’s standard price will be ${pounds(pricing.pro.standard.month)}/month or ${pounds(pricing.pro.standard.year)}/year once Reach ships; founding members keep ${pounds(pricing.pro.founding.month)}.`

/** What each feature does, and whether it's built. Only built ones are "live". */
export const PRO_FEATURE_COPY: Record<
  Feature,
  { label: string; status: "live" | "soon" }
> = {
  "library.team": {
    label: "Team organiser: assign staff to your libraries",
    status: "live",
  },
  "library.traffic": {
    label: "Traffic reports",
    status: "soon",
  },
  "atlas.export": {
    label: "Export Atlas results as CSV or GeoJSON",
    status: "live",
  },
  "atlas.contextLayers": {
    label: "Deprivation and transit layers",
    status: "soon",
  },
  "atlas.analysis": {
    label:
      "Travel-time reach, draw-to-analyse, coverage gaps and service coverage",
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
  "api.key": { label: "Higher allowances for the API add-on", status: "soon" },
}

/**
 * The line under a library's Changes list when values are hidden: the
 * field names are public, previous → next is Pro (`library.history`).
 */
export const LIBRARY_HISTORY_UPGRADE = {
  text: "See what changed, field by field, with Supporter or Pro.",
  href: "/contribute/membership",
} as const

/** A plan's features, read from the resolver so the copy can't drift from it. */
export function featuresOf(plan: DigitalPlanKey): Feature[] {
  const { features } = resolveEntitlements({
    signedIn: true,
    now: new Date(0),
    grants: [{ plan, expiresAt: null }],
  })

  return FEATURES.filter((f) => features.has(f))
}

const feature = (text: string): PlanInclude => ({ text, kind: "feature" })

export function exportLimitOf(plan: "supporter" | "pro" | "team") {
  return resolveEntitlements({
    signedIn: true,
    now: new Date(0),
    grants: [{ plan, expiresAt: null }],
  }).limits.exportRows
}
const soon = (text: string): PlanInclude => ({
  text: `${text} (coming soon)`,
  kind: "soon",
})
const note = (text: string): PlanInclude => ({ text, kind: "note" })

/** Live features first, listed plainly; the rest flagged "(coming soon)". */
function featureItems(
  features: readonly Feature[],
  plan?: "supporter" | "pro" | "team"
): PlanInclude[] {
  const copy = features.map((f) => ({
    ...PRO_FEATURE_COPY[f],
    label:
      f === "atlas.export" && plan
        ? `${PRO_FEATURE_COPY[f].label} (up to ${exportLimitOf(plan).toLocaleString("en-GB")} libraries per download)`
        : PRO_FEATURE_COPY[f].label,
  }))

  return [
    ...copy.filter((c) => c.status === "live").map((c) => feature(c.label)),
    ...(features.includes("atlas.analysis")
      ? [feature(ATLAS_PER_CAPITA_LABEL)]
      : []),
    ...copy.filter((c) => c.status === "soon").map((c) => soon(c.label)),
  ]
}

const PRO_ONLY = featuresOf("pro")
const SUPPORTER_ONLY = featuresOf("supporter")
// Inherited features are covered by "Everything in Supporter". Export stays
// explicit because Pro raises the per-download limit.
const PRO_UPGRADES = PRO_ONLY.filter(
  (feature) => feature === "atlas.export" || !SUPPORTER_ONLY.includes(feature)
)
const TEAM_ONLY = featuresOf("team").filter((f) => !PRO_ONLY.includes(f))
const TEAM_FEATURES = featureItems(TEAM_ONLY)

/**
 * Team's list: Pro for every seat, then what the Team organiser and a
 * covered library's owners can do today (`library.team` plus choosing who
 * may go live, which the knowledge base describes as one feature), then
 * what's on the roadmap.
 */
const TEAM_TRAFFIC = soon(PRO_FEATURE_COPY["library.traffic"].label)
const TEAM_INCLUDES: PlanInclude[] = [
  feature("Pro for every seat"),
  ...TEAM_FEATURES.filter((i) => i.kind === "feature"),
  feature("Choose who can go live for a mobile library"),
  feature("Optional API add-on with managed keys and usage reporting"),
  TEAM_TRAFFIC,
  ...TEAM_FEATURES.filter(
    (i) => i.kind === "soon" && i.text !== TEAM_TRAFFIC.text
  ),
  note(
    "We set up the Team, its libraries and its seats. Your team organiser then invites colleagues and assigns them to your libraries."
  ),
]

/** "Ask about Team for your service": a mailto until checkout exists. */
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
      feature("Read the Journal, Knowledge articles, events and noticeboard"),
      feature("Browse community drives and library notices and timetables"),
      feature("Library record downloads"),
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
      feature("Join community drives; propose one after 5 accepted changes"),
      feature("Suggest Knowledge edits and pitch Journal stories"),
      feature("Apply for Knowledge or Journal editing roles"),
      feature("Claim your library and use the free staff tools"),
      soon("3 saved views and 3 saved searches"),
      feature("An opt-in weekly digest of followed libraries"),
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
    price: {
      monthly: `${pounds(pricing.supporter.month)}/month`,
      yearly: `${pounds(pricing.supporter.year)}/year`,
    },
    who: "People who value the index and want to keep it running",
    includes: [
      feature("Everything in Free account"),
      feature("An optional Supporter mark you can hide"),
      feature("Optional credit on the supporters page"),
      ...featureItems(SUPPORTER_ONLY, "supporter"),
      note(
        "Payment never changes your community role or how edits are reviewed."
      ),
    ],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "pro",
    name: "Pro",
    price: {
      monthly: `${pounds(pricing.pro.founding.month)}/month`,
      yearly: `${pounds(pricing.pro.founding.year)}/year`,
      note: "Founding price, held while you stay a member.",
    },
    who: "Researchers, journalists, consultants and enthusiasts",
    includes: [
      feature("Everything in Supporter"),
      ...featureItems(PRO_UPGRADES, "pro"),
    ],
    cta: { kind: "soon", label: "Coming soon" },
  },
  {
    key: "team",
    name: "Team",
    price: {
      yearly: `${pounds(pricing.team.year)}/year ex VAT`,
      note: `Includes ${pricing.team.includedSeats} seats; ${pounds(pricing.team.extraSeatYear)}/year per extra seat. Public library services get ${pricing.team.publicServiceDiscountPercent}% off: ${pounds(pricing.team.year * publicServiceRate)}/year and ${pounds(pricing.team.extraSeatYear * publicServiceRate)}/year per extra seat, ex VAT.`,
    },
    who: "Library services, councils, universities and consultancies",
    includes: TEAM_INCLUDES,
    cta: { kind: "contact", label: "Talk to us", href: TEAM_CONTACT_HREF },
  },
]

/** Short summaries for the supporters page; planned status follows the plan copy. */
export const FREE_FEATURE_SUMMARIES = [
  {
    title: "Every library record",
    icon: "mdi:bank-outline",
    description:
      "Hours, addresses, accessibility and sources, without an account.",
    include: "Every library record",
  },
  {
    title: "Library record downloads",
    icon: "mdi:download",
    description:
      "Export from any library page as CSV or JSON, with sources and licence.",
    include: "Library record downloads",
  },
  {
    title: "Suggest corrections and add libraries",
    icon: "mdi:pencil-outline",
    description: "Every change is reviewed, then credited to you.",
    include: "Contribute corrections",
  },
  {
    title: "Noticeboard and drives",
    icon: "mdi:pin-outline",
    description:
      "Join community drives, or propose one once you have 5 accepted changes.",
    include: "Join community drives",
  },
  {
    title: "Knowledge and journal editing",
    icon: "mdi:file-document-outline",
    description:
      "Suggest edits and pitch stories; apply for an editor role to write and review articles.",
    include: "Apply for Knowledge",
  },
  {
    title: "Saved views and searches",
    icon: "mdi:bookmark-outline",
    description: "Keep 3 of each on a free account.",
    include: "3 saved views",
  },
  {
    title: "Weekly digest",
    icon: "mdi:email-outline",
    description:
      "An opt-in weekly email when libraries you follow have changed.",
    include: "An opt-in weekly digest",
  },
].map(({ include, ...copy }) => ({
  ...copy,
  planned:
    PLANS.filter((plan) => plan.key === "public" || plan.key === "free")
      .flatMap((plan) => plan.includes)
      .find((item) => item.text.startsWith(include))?.kind === "soon",
}))

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
    summary:
      "Library access compares libraries per resident across countries and UK local areas. Atlas export is included; Reach is on the way.",
  },
  {
    key: "team",
    tagline: "For library services",
    summary:
      "Library access and the other Pro tools for every seat, plus a team organiser who assigns staff to your libraries.",
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
 * The plan's short name for a menu chip: "Free", "Supporter", "Pro" or
 * "Team". A missing or unknown plan reads as Free (missing session fields
 * deny), so the account menu and the Contribute menu never say more than
 * the session does.
 */
export function planShortName(plan: string | null | undefined): string {
  switch (plan) {
    case "team":
      return "Team"
    case "pro":
      return "Pro"
    case "supporter":
      return "Supporter"

    default:
      return "Free"
  }
}

/**
 * One line on how the member holds their plan, or null when there's nothing
 * to say (free, public, or a value we don't recognise).
 */
export function planStatusCopy(
  plan: string | null | undefined,
  planSource: string | null | undefined
): string | null {
  const name =
    plan === "supporter"
      ? "Supporter"
      : plan === "pro"
        ? "Pro"
        : plan === "team"
          ? "Team"
          : null
  if (!name) return null

  switch (planSource) {
    case "grant":
      return `You have ${name}, granted by the libraries.global team.`
    case "earned":
      return `You have ${name} for your contributions (Archivist tier).`
    case "verified":
      return `You have ${name} as verified library staff, student or charity.`
    case "team":
      return `You have ${name} through your Team seat.`
    case "paid":
      return `You're on ${name}.`

    default:
      return null
  }
}
