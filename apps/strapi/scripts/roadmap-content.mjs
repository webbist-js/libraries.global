/**
 * English Roadmap copy. Features follow the owner's roadmap design. Dataset
 * imports differ by target: production lists real candidates only (no
 * counts until a source has been checked); `--local` adds fixture imports
 * at the later steps, with illustrative counts, for feature development.
 */

const plan = (name, detail) =>
  detail ? { plan: name, detail } : { plan: name }
const fields = (...labels) => labels.map((text) => ({ text }))

const FEATURES = [
  {
    key: "save-views",
    title: "Save views and searches",
    description:
      "Keep an Atlas view, with its map position, layers and filters, and come back to it or share the link.",
    stage: "now",
    area: "atlas",
    plans: [plan("free", "up to 1,000")],
    noteKind: "target",
    note: "Aiming for December",
  },
  {
    key: "compare-libraries",
    title: "Compare up to 6 libraries side by side",
    description:
      "Hours, services, accessibility and recent changes in one table. Add libraries from search, the Atlas or your lists.",
    stage: "now",
    area: "watching",
    plans: [plan("free")],
    noteKind: "target",
    note: "Aiming for January",
  },
  {
    key: "more-widgets",
    title: "More widgets",
    description:
      "Events and a mobile library timetable, ready to embed beside the finder, directory, charts and stats that staff workspaces already have.",
    stage: "now",
    area: "widgets",
    plans: [plan("free", "verified staff")],
    noteKind: "target",
    note: "Aiming for December",
  },
  {
    key: "traffic-reports",
    title: "Traffic reports",
    description:
      "Page views, visitors and what people searched for before they found your library, for the verified staff of that library.",
    stage: "now",
    area: "teams",
    plans: [plan("free", "verified staff")],
    noteKind: "testing",
    note: "In testing with 4 library services",
  },
  {
    key: "watch-library",
    title: "Watch a library for changes and closures",
    description:
      "Follow any library and hear when its hours change, it moves, or it closes for a while or for good.",
    stage: "next",
    area: "watching",
    plans: [plan("free")],
  },
  {
    key: "search-alerts",
    title: "Alerts on saved searches",
    description:
      "An email when a library inside one of your saved searches is added, closes or changes.",
    stage: "next",
    area: "atlas",
    plans: [plan("free")],
    noteKind: "depends",
    note: "Builds on saved views and searches",
  },
  {
    key: "free-widgets",
    title: "Free widgets",
    description:
      "A simple opening-times card any library or community site can embed at no cost.",
    stage: "next",
    area: "widgets",
    plans: [plan("free")],
  },
  {
    key: "export-attribution",
    title: "Export search results with attribution",
    description:
      "Download results with the source and licence of every record attached, ready to cite or publish.",
    stage: "next",
    area: "atlas",
    plans: [plan("free")],
  },
  {
    key: "calendar-feed",
    title: "Personal calendar feed for events",
    description:
      "Subscribe in Google, Apple or Outlook calendar to events from the libraries you follow.",
    stage: "next",
    area: "events",
    plans: [plan("free")],
  },
  {
    key: "private-notes",
    title: "Private notes on any library",
    description:
      "Notes only you can see, kept alongside a library’s record and searchable in your lists.",
    stage: "next",
    area: "watching",
    plans: [plan("free")],
  },
  {
    key: "bulk-updates",
    title: "Bulk updates from a spreadsheet",
    description:
      "Upload hours or contact changes for many branches at once. Each row still goes through review.",
    stage: "later",
    area: "teams",
    plans: [plan("free", "verified staff")],
  },
  {
    key: "benchmark-services",
    title: "Benchmark services against similar ones",
    description:
      "See how a service compares on hours, branches and reach with others of a similar size and population.",
    stage: "later",
    area: "atlas",
    plans: [plan("free")],
  },
  {
    key: "shared-workspace",
    title: "Shared Atlas workspace",
    description:
      "Saved views, notes and library selections that everyone in your staff workspace can see and edit together.",
    stage: "later",
    area: "teams",
    plans: [plan("free", "verified staff")],
  },
  {
    key: "api-allowances",
    title: "Higher API allowances",
    description:
      "Larger allowances on the paid API, for apps, research projects and data journalism.",
    stage: "later",
    area: "data",
    plans: [plan("api")],
  },
]

/**
 * Production imports. Germany and Spain have registered Datasets and draft
 * adapters (src/seeds/datasets.ts); Ireland has council-level adapters. The
 * "listed" entries are candidates nobody has started on. No counts are
 * shown until a source has been checked.
 */
const REGISTERED_IMPORTS = [
  {
    key: "germany-isil",
    place: "Germany",
    code: "DE",
    source: "Deutsches ISIL-Verzeichnis, the German library registry",
    fields: fields("Addresses", "Library types", "ISIL codes"),
    stage: "exploring",
    stageNote: "Working out how its records map to ours",
  },
  {
    key: "spain-mcu",
    place: "Spain",
    code: "ES",
    source: "Directorio de Bibliotecas Españolas",
    fields: fields("Addresses", "Contacts", "Library types"),
    stage: "exploring",
    stageNote: "Also confirming the licence with the ministry",
  },
  {
    key: "ireland-councils",
    place: "Ireland",
    code: "IE",
    source: "Local authority open data, council by council",
    fields: fields("Addresses", "Opening hours", "Contacts"),
    stage: "exploring",
    stageNote: "Four councils looked at so far",
  },
  {
    key: "portugal-rnbp",
    place: "Portugal",
    code: "PT",
    source: "Rede Nacional de Bibliotecas Públicas",
    fields: [],
    stage: "listed",
  },
  {
    key: "brazil-snbp",
    place: "Brazil",
    code: "BR",
    source: "Sistema Nacional de Bibliotecas Públicas",
    fields: [],
    stage: "listed",
  },
  {
    key: "japan-ndl-isil",
    place: "Japan",
    code: "JP",
    source: "National Diet Library ISIL registry",
    fields: [],
    stage: "listed",
  },
  {
    key: "new-zealand",
    place: "New Zealand",
    code: "NZ",
    source: "Public Libraries of New Zealand directory",
    fields: [],
    stage: "listed",
  },
  {
    key: "kenya",
    place: "Kenya",
    code: "KE",
    source: "Kenya National Library Service branch list",
    fields: [],
    stage: "listed",
  },
]

/** Local-only examples of the later steps, with illustrative counts. */
const FIXTURE_IMPORTS = [
  {
    key: "fixture-validating",
    place: "Netherlands",
    code: "NL",
    source: "Example dataset (local fixture)",
    fields: fields("Addresses", "Contacts", "Opening hours"),
    libraries: 1280,
    stage: "validating",
    stageNote: "About 70% of records checked",
  },
  {
    key: "fixture-licensing",
    place: "Canada",
    regions: "Ontario, British Columbia, Alberta",
    code: "CA",
    source: "Example dataset (local fixture)",
    fields: fields("Opening hours", "Services", "Accessibility"),
    libraries: 610,
    stage: "licensing",
    stageNote: "Waiting on two provinces",
  },
  {
    key: "fixture-ingesting",
    place: "Poland",
    code: "PL",
    source: "Example dataset (local fixture)",
    fields: fields("Addresses", "Library types"),
    libraries: 7900,
    stage: "ingesting",
    stageNote: "Drafts in review",
  },
  {
    key: "fixture-ingested",
    place: "Finland",
    code: "FI",
    source: "Example dataset (local fixture)",
    fields: fields("Addresses", "Opening hours", "Contacts"),
    libraries: 712,
    stage: "ingested",
    stageNote: "Added in October",
  },
]

export function roadmapContent({ fixtures = false } = {}) {
  return {
    title: "What we’re *building next*",
    lead: "What we’re building, what comes next and the datasets on their way into the index. Vote for what matters to you and tell us how you’d use it.",
    features: FEATURES,
    dataTitle: "Coming into the index",
    dataLead:
      "Open datasets we’re looking at. Each one goes through four steps: we explore the source, validate its data, make sure its licence lets us republish it, then ingest it once. After that, contributors and library staff keep the records current, and an import never overwrites their edits.",
    dataImports: fixtures
      ? [...FIXTURE_IMPORTS, ...REGISTERED_IMPORTS]
      : REGISTERED_IMPORTS,
    suggestPrompt:
      "Know an open dataset for your country or region? Tell us the source and its licence.",
    footnote:
      "Labels show who each feature is intended for; they can change as we learn. Votes help us order the work but don’t decide it alone. Everything factual about libraries stays free, and staff tools are free for verified staff.",
  }
}
