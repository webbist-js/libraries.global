import type {
  CtaBand,
  Journey,
  LinkCard,
  SectionIntro,
  Step,
} from "@/components/home/homepage.types"

/**
 * Fallback copy for every CMS-editable homepage section. The CMS values win
 * field-by-field (see `withFallback`), so an editor can override one line
 * without having to fill the whole component.
 */
type HomepageDefaults = {
  heroEyebrow: string
  heroTitle: string
  heroText: string
  journeysIntro: SectionIntro
  journeys: Journey[]
  featuredIntro: SectionIntro
  communityBand: CtaBand
  communitySteps: Step[]
  tasksIntro: SectionIntro
  atlasBand: CtaBand
  plansIntro: SectionIntro
  coverageIntro: SectionIntro
  eventsIntro: SectionIntro
  journalIntro: SectionIntro
  knowledgeBand: CtaBand
  knowledgeLinks: LinkCard[]
  finalCta: CtaBand
  finalBenefits: Step[]
  openIntro: SectionIntro
  openLinks: LinkCard[]
}

export const HOMEPAGE_DEFAULTS: HomepageDefaults = {
  heroEyebrow: "Open data · Open source · Free to use",
  heroTitle: "Every library, *one map.*",
  heroText:
    "An open record of the world’s libraries: find one near you, see how places are served, and help document the rest.",

  journeysIntro: {
    title: "Find them. Learn about them. *Help document them.*",
    text: null,
  },

  journeys: [
    {
      tone: "explore",
      eyebrow: "For visitors",
      title: "Find a library",
      text: "Search by name or place, check hours and access, and plan a visit.",
      ctaLabel: "Browse the index",
      ctaHref: "/libraries",
    },
    {
      tone: "contribute",
      eyebrow: "For anyone who knows a library",
      title: "Help build the index",
      text: "Add missing libraries, fix details and share photos. Reviewers check every change.",
      ctaLabel: "Start contributing",
      ctaHref: "/contribute",
    },
    {
      tone: "analyse",
      eyebrow: "For researchers and planners",
      title: "Analyse access",
      text: "Map library locations, opening hours and accessibility features. Compare libraries with resident populations using Library access on Pro or Team.",
      ctaLabel: "Open the atlas",
      ctaHref: "/map",
    },
  ],

  atlasBand: {
    title: "See how places *are served.*",
    text: "Every library on one map. Filter by type, opening hours or services, then switch on layers for accessibility, events and record completeness.",
    primaryLabel: "Open the atlas",
    primaryHref: "/map",
    secondaryLabel: "What Pro adds",
    secondaryHref: "/contribute/membership",
  },

  communityBand: {
    title: "Two minutes can *finish a record.*",
    text: "You don’t need to be a librarian. Pick a gap, add what you know with a source, and a reviewer checks it. Every accepted change is credited to you.",
    primaryLabel: "Start contributing",
    primaryHref: "/contribute",
    secondaryLabel: "Add a missing library",
    secondaryHref: "/contribute/index/new",
  },

  communitySteps: [
    { title: "Pick a gap", text: null },
    { title: "Add it with a source", text: null },
    { title: "A reviewer checks it", text: null },
  ],

  tasksIntro: {
    title: "Open tasks right now",
    text: null,
  },

  featuredIntro: {
    title: "Libraries *worth knowing*",
    text: null,
  },

  coverageIntro: {
    title: "Where we are *so far.*",
    text: "There’s no complete open record of the world’s libraries. We’re building one, country by country. Counts are published records only.",
  },

  plansIntro: {
    title: "Library facts are *always free.*",
    text: "Plans pay for analysis and extra data and keep the index independent. No ads, and money never buys a place in the index.",
  },

  eventsIntro: {
    title: "What’s on at libraries",
    text: "Talks, exhibitions, storytimes and workshops, collected from library calendars and booking sites.",
  },

  journalIntro: {
    title: "From the *journal*",
    text: null,
  },

  knowledgeBand: {
    title: "How it all works, *in plain words.*",
    text: null,
    primaryLabel: "Knowledge hub",
    primaryHref: "/knowledge",
    secondaryLabel: null,
    secondaryHref: null,
  },

  knowledgeLinks: [
    {
      title: "Finding a library",
      text: "Browse by place, search and filter the index, or explore the map.",
      href: "/knowledge/getting-started/finding-a-library",
    },
    {
      title: "How review works",
      text: "Who checks contributions, and what happens to yours.",
      href: "/knowledge/governance/how-review-works",
    },
    {
      title: "Claiming a library you work for",
      text: "How staff and volunteers become verified stewards of a record.",
      href: "/knowledge/contributing/claiming-your-library",
    },
    {
      title: "Reusing the data",
      text: "The licence on records and photos, and what it asks of you.",
      href: "/knowledge/data-api/reusing-the-data",
    },
  ],

  // The closing band shows the title and one step per column, the primary
  // call to action under the first and the secondary under the second.
  finalCta: {
    title: "Know a library? *Put it on the map.*",
    text: null,
    primaryLabel: "Create a free account",
    primaryHref: "/auth/register",
    secondaryLabel: "Make your first contribution",
    secondaryHref: "/contribute",
  },

  finalBenefits: [
    {
      title: "Join the index",
      text: "A free account takes a minute. Follow the libraries you care about and get credit for every accepted change.",
    },
    {
      title: "Add what you know",
      text: "Fill a gap in a record or add a missing library. A reviewer checks it first, and regular contributors get Pro free.",
    },
  ],

  openIntro: {
    title: "Open by design",
    text: null,
  },

  openLinks: [
    {
      title: "Source code",
      text: "The whole platform is open source. Read it, fork it, improve it.",
      href: "https://github.com/webbist-js/libraries.global",
    },
    {
      title: "Methodology",
      text: "What we include, how we count, and known gaps.",
      href: "/knowledge/data-api/how-we-count",
    },
    {
      title: "Data licence",
      text: "Reuse the index under an open licence, with provenance.",
      href: "/legal/data-licence",
    },
  ],
}

/**
 * The homepage closing band's first step for a signed-in member, in place of
 * the join step and its sign-up button.
 */
export const CLOSING_MEMBER_STEP: Step & { ctaLabel: string; ctaHref: string } =
  {
    title: "You’ve joined the index",
    text: "Follow the libraries you care about, and get credit for every change of yours that’s accepted.",
    ctaLabel: "Find libraries to follow",
    ctaHref: "/libraries",
  }

/**
 * The contribute prompt above the Find libraries list: the homepage's
 * closing ask, with what an account gets you in place of its two steps.
 */
export const FIND_CONTRIBUTE_PROMPT: { band: CtaBand; benefits: Step[] } = {
  band: {
    title: "Know a library? *Put it on the map.*",
    text: "A free account takes a minute. You get credit for every accepted change, and regular contributors get Pro free.",
    primaryLabel: "Create a free account",
    primaryHref: "/auth/register",
    secondaryLabel: "Make your first contribution",
    secondaryHref: "/contribute",
  },
  benefits: [
    {
      title: "Suggest and publish improvements",
      text: "Reviewed, sourced, credited to you.",
    },
    {
      title: "Follow the libraries you care about",
      text: "Hear about changes and events.",
    },
    {
      title: "Earn trust over time",
      text: "From contributor to reviewer or steward.",
    },
    {
      title: "Pro free for regular contributors",
      text: "Unlock atlas analysis by helping out.",
    },
  ],
}

type Nullable<T> = { [K in keyof T]?: T[K] | null }

/** Field-level merge: any blank CMS field falls back to the default. */
export function withFallback<T extends object>(
  cms: Nullable<T> | null | undefined,
  fallback: T
): T {
  const overrides = Object.entries(cms ?? {}).filter(
    ([key, value]) =>
      key !== "id" && key !== "__component" && value != null && value !== ""
  )

  return { ...fallback, ...Object.fromEntries(overrides) }
}

/** Repeatable components: the CMS list replaces the defaults when non-empty. */
export function listOrFallback<T>(
  cms: readonly T[] | null | undefined,
  fallback: readonly T[]
): readonly T[] {
  return Array.isArray(cms) && cms.length > 0 ? cms : fallback
}

type HomepageCms = {
  heroEyebrow?: string | null
  heroTitle?: string | null
  heroText?: string | null
  journeysIntro?: SectionIntro | null
  journeys?: Journey[] | null
  featuredIntro?: SectionIntro | null
  communityBand?: CtaBand | null
  communitySteps?: Step[] | null
  tasksIntro?: SectionIntro | null
  atlasBand?: CtaBand | null
  plansIntro?: SectionIntro | null
  coverageIntro?: SectionIntro | null
  eventsIntro?: SectionIntro | null
  journalIntro?: SectionIntro | null
  knowledgeBand?: CtaBand | null
  knowledgeLinks?: LinkCard[] | null
  finalCta?: CtaBand | null
  finalBenefits?: Step[] | null
  openIntro?: SectionIntro | null
  openLinks?: LinkCard[] | null
}

export type HomepageContent = {
  readonly [K in keyof HomepageDefaults]: HomepageDefaults[K] extends (infer U)[]
    ? readonly U[]
    : HomepageDefaults[K]
}

/** Resolve every homepage section's copy: CMS first, defaults underneath. */
export function resolveHomepageContent(
  cms: HomepageCms | null | undefined
): HomepageContent {
  const d = HOMEPAGE_DEFAULTS

  return {
    heroEyebrow: cms?.heroEyebrow || d.heroEyebrow,
    heroTitle: cms?.heroTitle || d.heroTitle,
    heroText: cms?.heroText || d.heroText,
    journeysIntro: withFallback(cms?.journeysIntro, d.journeysIntro),
    journeys: listOrFallback(cms?.journeys, d.journeys),
    featuredIntro: withFallback(cms?.featuredIntro, d.featuredIntro),
    communityBand: withFallback(cms?.communityBand, d.communityBand),
    communitySteps: listOrFallback(cms?.communitySteps, d.communitySteps),
    tasksIntro: withFallback(cms?.tasksIntro, d.tasksIntro),
    atlasBand: withFallback(cms?.atlasBand, d.atlasBand),
    plansIntro: withFallback(cms?.plansIntro, d.plansIntro),
    coverageIntro: withFallback(cms?.coverageIntro, d.coverageIntro),
    eventsIntro: withFallback(cms?.eventsIntro, d.eventsIntro),
    journalIntro: withFallback(cms?.journalIntro, d.journalIntro),
    knowledgeBand: withFallback(cms?.knowledgeBand, d.knowledgeBand),
    knowledgeLinks: listOrFallback(cms?.knowledgeLinks, d.knowledgeLinks),
    finalCta: withFallback(cms?.finalCta, d.finalCta),
    finalBenefits: listOrFallback(cms?.finalBenefits, d.finalBenefits),
    openIntro: withFallback(cms?.openIntro, d.openIntro),
    openLinks: listOrFallback(cms?.openLinks, d.openLinks),
  }
}
