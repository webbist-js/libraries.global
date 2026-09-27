import type {
  Citation,
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
  proofIntro: SectionIntro
  openDataDefinition: Citation
  journeysIntro: SectionIntro
  journeys: Journey[]
  featuredIntro: SectionIntro
  featuredPrompt: CtaBand
  tasksIntro: SectionIntro
  stewardBand: CtaBand
  coverageIntro: SectionIntro
  journalIntro: SectionIntro
  communityBand: CtaBand
  communitySteps: Step[]
  openIntro: SectionIntro
  openLinks: LinkCard[]
  finalCta: CtaBand
  finalBenefitsTitle: string
  finalBenefits: Step[]
  finalProgression: string
}

export const HOMEPAGE_DEFAULTS: HomepageDefaults = {
  heroEyebrow: "Open data · Open source · Built in public",
  heroTitle: "The world’s libraries, *documented together.*",
  heroText:
    "Discover libraries, collections and services around the world — and help build an open, community-maintained record of them.",

  proofIntro: {
    title: "Open data. Open source. Built in public.",
    text: "The index belongs to everyone. Explore it, correct it, download it and reuse it. The software behind it is open source too.",
  },

  openDataDefinition: {
    lead: "We follow the Open Data Institute’s definition of open data:",
    quote: "Open data is data that anyone can access, use and share.",
    attribution: "Open Data Institute",
    sourceLabel: "What is open data and why should we care?",
    sourceUrl:
      "https://theodi.org/insights/explainers/what-is-open-data-and-why-should-we-care/",
  },

  journeysIntro: {
    title: "Find them. Learn about them. *Help document them.*",
    text: null,
  },

  journeys: [
    {
      tone: "explore",
      eyebrow: "Explore",
      title: "Explore the world",
      text: "Discover libraries, collections and stories across the globe.",
      ctaLabel: "Explore the map",
      ctaHref: "/map",
    },
    {
      tone: "contribute",
      eyebrow: "Contribute",
      title: "Help build the index",
      text: "Add missing libraries, improve records and share what you know.",
      ctaLabel: "Start contributing",
      ctaHref: "/contribute",
    },
    {
      tone: "steward",
      eyebrow: "Your library",
      title: "Represent a library",
      text: "Work at a library? Keep its information accurate and tell its story.",
      ctaLabel: "Find your library",
      ctaHref: "/libraries",
    },
  ],

  featuredIntro: {
    title: "Libraries worth knowing",
    text: "Remarkable buildings, collections and histories from the growing index.",
  },

  featuredPrompt: {
    title: "Know a library we should include?",
    text: "Thousands are still missing.",
    primaryLabel: "Add a library",
    primaryHref: "/contribute/add",
  },

  tasksIntro: {
    title: "Help complete the map",
    text: "The index grows one contribution at a time. You don’t need to be a librarian or an expert — just add what you know.",
  },

  stewardBand: {
    title: "Is this your library?",
    text: "Library staff can become verified stewards of their library’s record: add collections and services, publish photographs and keep information accurate. The community can still suggest edits — stewards add institutional attribution.",
    primaryLabel: "Find your library",
    primaryHref: "/libraries",
    secondaryLabel: "Can’t find it? Add it to the index",
    secondaryHref: "/contribute/add",
  },

  coverageIntro: {
    title: "A map we’re building together",
    text: "No complete, open record of the world’s libraries exists. We’re building one — country by country, library by library, with the people who know them.",
  },

  journalIntro: {
    title: "From the journal",
    text: null,
  },

  communityBand: {
    title: "The index is only as good as the people who care for it.",
    text: "Librarians, researchers, travellers and local communities all know something about the libraries around them. Bring that knowledge together and we can build a record no single organisation could maintain alone.",
    primaryLabel: "Make your first contribution",
    primaryHref: "/contribute",
    secondaryLabel: "Create a contributor profile",
    secondaryHref: "/auth/register",
  },

  communitySteps: [
    {
      title: "Contribute",
      text: "Add a library, photo, collection or correction.",
    },
    {
      title: "Review",
      text: "Sources and community review keep information trustworthy.",
    },
    {
      title: "Publish",
      text: "Accepted contributions join the open global record, with attribution.",
    },
  ],

  openIntro: {
    title: "Open by design",
    text: "Open-source software, open data as the Open Data Institute defines it, a public methodology and community editing — with libraries themselves taking part.",
  },

  openLinks: [
    {
      title: "Source code",
      text: "The whole platform is open source. Read it, fork it, improve it.",
      href: "https://github.com/libraries-global/libraries.global",
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
      title: "Data licence & export",
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

  finalCta: {
    title: "Know a library? *Put it on the map.*",
    text: "Your workplace, your childhood library, an extraordinary collection you’ve visited or the library around the corner: help make sure it has a place in the world’s open library index.",
    primaryLabel: "Add a library",
    primaryHref: "/contribute/add",
    secondaryLabel: "Create your contributor profile",
    secondaryHref: "/auth/register",
  },

  finalBenefitsTitle: "A free contributor profile lets you",

  finalBenefits: [
    { title: "Suggest and publish improvements" },
    { title: "Follow the libraries you care about" },
    { title: "See your contribution history" },
    { title: "Earn credit for every accepted change" },
    { title: "Grow into reviewing community changes" },
  ],

  finalProgression:
    "Visitor → Contributor → Trusted contributor → Reviewer or steward",
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
  proofIntro?: SectionIntro | null
  openDataDefinition?: Citation | null
  journeysIntro?: SectionIntro | null
  journeys?: Journey[] | null
  featuredIntro?: SectionIntro | null
  featuredPrompt?: CtaBand | null
  tasksIntro?: SectionIntro | null
  stewardBand?: CtaBand | null
  coverageIntro?: SectionIntro | null
  journalIntro?: SectionIntro | null
  communityBand?: CtaBand | null
  communitySteps?: Step[] | null
  openIntro?: SectionIntro | null
  openLinks?: LinkCard[] | null
  finalCta?: CtaBand | null
  finalBenefitsTitle?: string | null
  finalBenefits?: Step[] | null
  finalProgression?: string | null
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
    proofIntro: withFallback(cms?.proofIntro, d.proofIntro),
    openDataDefinition: withFallback(
      cms?.openDataDefinition,
      d.openDataDefinition
    ),
    journeysIntro: withFallback(cms?.journeysIntro, d.journeysIntro),
    journeys: listOrFallback(cms?.journeys, d.journeys),
    featuredIntro: withFallback(cms?.featuredIntro, d.featuredIntro),
    featuredPrompt: withFallback(cms?.featuredPrompt, d.featuredPrompt),
    tasksIntro: withFallback(cms?.tasksIntro, d.tasksIntro),
    stewardBand: withFallback(cms?.stewardBand, d.stewardBand),
    coverageIntro: withFallback(cms?.coverageIntro, d.coverageIntro),
    journalIntro: withFallback(cms?.journalIntro, d.journalIntro),
    communityBand: withFallback(cms?.communityBand, d.communityBand),
    communitySteps: listOrFallback(cms?.communitySteps, d.communitySteps),
    openIntro: withFallback(cms?.openIntro, d.openIntro),
    openLinks: listOrFallback(cms?.openLinks, d.openLinks),
    finalCta: withFallback(cms?.finalCta, d.finalCta),
    finalBenefitsTitle: cms?.finalBenefitsTitle || d.finalBenefitsTitle,
    finalBenefits: listOrFallback(cms?.finalBenefits, d.finalBenefits),
    finalProgression: cms?.finalProgression || d.finalProgression,
  }
}
