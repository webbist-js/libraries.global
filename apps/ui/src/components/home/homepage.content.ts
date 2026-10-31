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
  libraryBand: CtaBand
  libraryTools: LinkCard[]
  trustItems: LinkCard[]
  heroEyebrow: string
  heroTitle: string
  heroText: string
  featuredIntro: SectionIntro
  communityBand: CtaBand
  communitySteps: Step[]
  tasksIntro: SectionIntro
  atlasBand: CtaBand
  plansIntro: SectionIntro
  journalIntro: SectionIntro
  knowledgeLinks: LinkCard[]
  finalCta: CtaBand
  openLinks: LinkCard[]
}

export const HOMEPAGE_DEFAULTS: HomepageDefaults = {
  libraryBand: {
    title: "Work at a library? This record is yours.",
    text: "Claim your library and keep its details right at the source: hours, services, accessibility, events and mobile stops. Publish once, wherever the record appears.",
    primaryLabel: "Claim your library",
    primaryHref: "/staff/claim",
    secondaryLabel: "Explore Teams",
    secondaryHref: "/plans#plan-team",
  },
  libraryTools: [
    {
      title: "Maintain hours, services and accessibility",
      text: "Free",
      href: "/staff",
    },
    {
      title: "Publish notices and connect your events feed",
      text: "Free",
      href: "/staff",
    },
    {
      title: "Manage mobile library routes and stops",
      text: "Free",
      href: "/staff",
    },
    {
      title: "A Team workspace for your service or network",
      text: "Team",
      href: "/staff/teams",
    },
    {
      title: "Embeddable library finders and comparison tools",
      text: "Team",
      href: "/staff/teams/widgets",
    },
    {
      title: "Connect your application to the library API",
      text: "API add-on",
      href: "/knowledge/data-api/reusing-the-data",
    },
  ],
  trustItems: [
    {
      title: "Sources",
      text: "Library websites, open datasets and local knowledge. Records retain their sources so you can follow the evidence.",
      href: "/knowledge/data-api/reusing-the-data",
    },
    {
      title: "Review",
      text: "Community suggestions are checked before publication. Verified staff can maintain their own library records, with a recorded history.",
      href: "/knowledge/governance/how-review-works",
    },
    {
      title: "Gaps",
      text: "Coverage is uneven. A missing record means a gap in the index, rather than a place without a library.",
      href: "/knowledge/data-api/how-we-count",
    },
    {
      title: "Reuse",
      text: "Explore the source code, check each dataset’s licence and attribution, or bring published records into your own tools.",
      href: "/knowledge/data-api/reusing-the-data",
    },
  ],
  heroEyebrow: "Open data · Open source · Free to use",
  heroTitle: "Every library, *one map.*",
  heroText:
    "Find a library near you, see when it opens and what it offers, and help finish the record. Free to browse, no account needed.",

  atlasBand: {
    title: "See how places *are served.*",
    text: "Explore libraries on a global map and compare library coverage with population. In the UK, choose a walking or cycling time to see how many people live within reach of a library or service.",
    primaryLabel: "Open the atlas",
    primaryHref: "/map",
    secondaryLabel: "How to read the Atlas",
    secondaryHref: "/knowledge/getting-started/exploring-the-atlas",
  },

  communityBand: {
    title: "Two minutes can *finish a record.*",
    text: "You don’t need to be a librarian. Share what you know and get credit for every accepted change.",
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
    title: "Libraries worth knowing",
    text: "Pillar institutions, chosen for their national, historical or cultural importance.",
  },

  plansIntro: {
    title: "Library facts are always free.",
    text: "Plans pay for analysis and extra data and keep the index independent. No ads, and money never buys a place in the index.",
  },

  journalIntro: {
    title: "From the journal",
    text: null,
  },

  knowledgeLinks: [
    {
      title: "Getting started: finding and following libraries",
      text: "Browse by place, search and filter the index, or explore the map.",
      href: "/knowledge/getting-started/finding-a-library",
    },
    {
      title: "Reading a library page",
      href: "/knowledge/getting-started/reading-a-library-page",
    },
    {
      title: "Adding a missing library",
      href: "/knowledge/contributing/adding-a-missing-library",
    },
    {
      title: "Contributing and how review works",
      text: "Who checks contributions, and what happens to yours.",
      href: "/knowledge/governance/how-review-works",
    },
    {
      title: "Managing your library’s record",
      text: "How staff and volunteers become verified stewards of a record.",
      href: "/knowledge/contributing/claiming-your-library",
    },
    {
      title: "Using the Atlas and reading its layers",
      href: "/knowledge/getting-started/exploring-the-atlas",
    },
    {
      title: "How we count libraries and coverage",
      href: "/knowledge/data-api/how-we-count",
    },
    {
      title: "Reusing the data: licences and API",
      text: "The licence on records and photos, and what it asks of you.",
      href: "/knowledge/data-api/reusing-the-data",
    },
  ],

  // The closing band shows the title and one step per column, the primary
  // call to action under the first and the secondary under the second.
  finalCta: {
    title: "Know a library? *Put it on the map.*",
    text: "An open record, built together. Browsing and searching are free. Membership supports the servers, review tools and analysis that keep the record independent.",
    primaryLabel: "Contribute",
    primaryHref: "/contribute",
    secondaryLabel: "Support the project",
    secondaryHref: "/community/supporters",
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
 * The contribute prompt above the Find libraries list: the homepage's
 * closing ask, with what an account gets you in place of its two steps.
 */
export const FIND_CONTRIBUTE_PROMPT: { band: CtaBand; benefits: Step[] } = {
  band: {
    title: "Know a library? Put it on the map.",
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
  contentTitle?: string | null
  contentText?: string | null
  contentCtaLabel?: string | null
  contentCtaHref?: string | null
  heroEyebrow?: string | null
  heroTitle?: string | null
  heroText?: string | null
  journeys?: Journey[] | null
  featuredIntro?: SectionIntro | null
  communityBand?: CtaBand | null
  communitySteps?: Step[] | null
  tasksIntro?: SectionIntro | null
  atlasBand?: CtaBand | null
  plansIntro?: SectionIntro | null
  journalIntro?: SectionIntro | null
  knowledgeLinks?: LinkCard[] | null
  finalCta?: CtaBand | null
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
    // The existing CMS content CTA, steward journeys and open links own these sections.
    libraryBand: withFallback(
      {
        title: cms?.contentTitle,
        text: cms?.contentText,
        primaryLabel: cms?.contentCtaLabel,
        primaryHref: cms?.contentCtaHref,
      },
      d.libraryBand
    ),
    libraryTools: listOrFallback(
      cms?.journeys
        ?.filter((journey) => journey.tone === "steward")
        .map((journey) => ({
          title: journey.title,
          text: journey.text,
          href: journey.ctaHref,
        })),
      d.libraryTools
    ),
    trustItems: listOrFallback(cms?.openLinks, d.trustItems),
    heroEyebrow: cms?.heroEyebrow || d.heroEyebrow,
    heroTitle: cms?.heroTitle || d.heroTitle,
    heroText: cms?.heroText || d.heroText,
    featuredIntro: withFallback(cms?.featuredIntro, d.featuredIntro),
    communityBand: withFallback(cms?.communityBand, d.communityBand),
    communitySteps: listOrFallback(cms?.communitySteps, d.communitySteps),
    tasksIntro: withFallback(cms?.tasksIntro, d.tasksIntro),
    atlasBand: withFallback(cms?.atlasBand, d.atlasBand),
    plansIntro: withFallback(cms?.plansIntro, d.plansIntro),
    journalIntro: withFallback(cms?.journalIntro, d.journalIntro),
    knowledgeLinks: listOrFallback(cms?.knowledgeLinks, d.knowledgeLinks),
    finalCta: withFallback(cms?.finalCta, d.finalCta),
    openLinks: d.openLinks,
  }
}
