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
  stewardBand: CtaBand
  journalIntro: SectionIntro
  finalCta: CtaBand
  finalBenefits: Step[]
  openIntro: SectionIntro
  openLinks: LinkCard[]
}

export const HOMEPAGE_DEFAULTS: HomepageDefaults = {
  heroEyebrow: "Open data · Open source · Free to use",
  heroTitle: "The world’s libraries, *documented together.*",
  heroText:
    "Find a library, explore the atlas, and help build an open record anyone can use.",

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
      eyebrow: "For everyone who knows a library",
      title: "Help build the index",
      text: "Add missing libraries, fix details and share photos. Reviewers check every change.",
      ctaLabel: "Start contributing",
      ctaHref: "/contribute",
    },
    {
      tone: "analyse",
      eyebrow: "For researchers and planners",
      title: "Analyse access",
      text: "Map where libraries are, when they open and how step-free they are. Deeper analysis is coming with Pro.",
      ctaLabel: "Open the atlas",
      ctaHref: "/map",
    },
  ],

  featuredIntro: {
    title: "Libraries worth knowing",
    text: "Buildings, collections and histories from the growing index.",
  },

  communityBand: {
    title: "Two minutes can finish a record.",
    text: "You don’t need to be a librarian. Pick a gap, add what you know with a source, and a reviewer checks it. Every accepted change is credited to you.",
    primaryLabel: "Start contributing",
    primaryHref: "/contribute",
    secondaryLabel: "Add a missing library",
    secondaryHref: "/contribute/add",
  },

  communitySteps: [
    { title: "Pick a gap.", text: "Hours, photos, access." },
    { title: "Add it with a source.", text: "A website or your own visit." },
    {
      title: "A reviewer checks it.",
      text: "Then it’s published, with credit.",
    },
  ],

  tasksIntro: {
    title: "Open tasks",
    text: null,
  },

  atlasBand: {
    title: "See how places are served.",
    text: "The atlas puts every library on one map. Filter by type, opening hours or services, then switch on layers for step-free access, events and record completeness.",
    primaryLabel: "Open the atlas",
    primaryHref: "/map",
    secondaryLabel: "What Pro adds",
    secondaryHref: "/contribute/membership",
  },

  plansIntro: {
    title: "Library facts are always free.",
    text: "Plans pay for analysis and extra data, and keep the index independent. No ads, and money never buys a place in the index.",
  },

  coverageIntro: {
    title: "Where we are so far",
    text: "There’s no complete open record of the world’s libraries. We’re building one, country by country. Counts are published records only.",
  },

  stewardBand: {
    title: "Is this your library?",
    text: "Staff can become verified stewards of their library’s record: add collections and photos and keep information accurate. The community can still suggest edits.",
    primaryLabel: "Find your library",
    primaryHref: "/libraries",
    secondaryLabel: "Team plans for library services",
    secondaryHref: "/contribute/membership",
  },

  journalIntro: {
    title: "From the journal",
    text: null,
  },

  finalCta: {
    title: "Know a library? *Put it on the map.*",
    text: "A free account takes a minute. You get credit for every accepted change, and regular contributors get Pro free.",
    primaryLabel: "Create a free account",
    primaryHref: "/auth/register",
    secondaryLabel: "Make your first contribution",
    secondaryHref: "/contribute",
  },

  finalBenefits: [
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
      title: "Contribution guide",
      text: "How to add and edit records, and what counts as a good source.",
      href: "/knowledge/contributing/how-to-contribute",
    },
    {
      title: "Governance",
      text: "Who reviews changes and how decisions are made.",
      href: "/knowledge",
    },
    {
      title: "Data licence",
      text: "Download the index under an open licence, with provenance.",
      href: "/legal/data-licence",
    },
    {
      title: "API",
      text: "Query libraries by place, type and services.",
      href: "/knowledge",
    },
    {
      title: "Methodology",
      text: "What we include, how we verify, and known gaps.",
      href: "/knowledge",
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
  stewardBand?: CtaBand | null
  journalIntro?: SectionIntro | null
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
    stewardBand: withFallback(cms?.stewardBand, d.stewardBand),
    journalIntro: withFallback(cms?.journalIntro, d.journalIntro),
    finalCta: withFallback(cms?.finalCta, d.finalCta),
    finalBenefits: listOrFallback(cms?.finalBenefits, d.finalBenefits),
    openIntro: withFallback(cms?.openIntro, d.openIntro),
    openLinks: listOrFallback(cms?.openLinks, d.openLinks),
  }
}
