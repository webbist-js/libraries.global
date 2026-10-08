import { readFileSync } from "node:fs"

import { beforeAll, describe, expect, it, vi } from "vitest"

import pluginsConfig from "../config/plugins"
import type * as SeedModule from "../scripts/seed-meilisearch"
import { LIBRARY_SHAPES } from "../src/utils/populate-shapes"

/**
 * Guards the Meilisearch index configuration against leaking private data.
 *
 * The plugin fetches entries with `entriesQuery` (default: every field and
 * `populate: "*"`), runs `transformEntry`, then indexes the result under a key
 * the browser's public search key can read. Without an explicit field list
 * and allowlisted transform, whole `user-profile` rows (contributors) and
 * admin `createdBy`/`updatedBy` users end up in the public index.
 *
 * The plugin builds `_meilisearch_id` from the *transformed* document's
 * `documentId` and `locale`, and drops unpublished entries by reading
 * `publishedAt` off the raw entry, so those must survive as well.
 */

type PopulateNode = {
  fields?: unknown
  populate?: Record<string, PopulateNode>
}

type IndexConfig = {
  settings: {
    searchableAttributes?: string[]
    filterableAttributes?: string[]
    sortableAttributes?: string[]
    displayedAttributes?: string[]
  }
  entriesQuery?: {
    fields?: unknown
    populate?: Record<string, PopulateNode>
    locale?: string
  }
  transformEntry?: (args: {
    entry: Record<string, unknown>
  }) => Record<string, unknown>
}

const INDEXES = ["blog-article", "wiki-article", "library", "event"] as const

type IndexName = (typeof INDEXES)[number]

/** Localized content types carry a `locale`; the events plugin type does not. */
const LOCALIZED = new Set<IndexName>([
  "blog-article",
  "wiki-article",
  "library",
])

/** Keys that must never reach a public index. */
const LEAK_KEYS = [
  "baUserId",
  "notifPrefs",
  "publicPrefs",
  "earnedProUntil",
  "firstName",
  "lastName",
  "createdBy",
  "updatedBy",
  "contributors",
  "email",
  "phone",
  "syncHash",
  "credentialId",
]

/**
 * What `apps/ui/src/lib/meilisearch.ts` (and the other UI callers) put in
 * `attributesToRetrieve`, filter on, or sort by. Every one of these must be a
 * displayed attribute or the UI silently loses data.
 */
const UI_READS: Record<IndexName, string[]> = {
  "blog-article": ["id", "documentId", "slug", "title", "section_slug"],
  "wiki-article": [
    "id",
    "documentId",
    "slug",
    "title",
    "summary",
    "section_slug",
    "section_name",
    "category_slug",
  ],
  library: [
    "id",
    "documentId",
    "name",
    "slug",
    "entityRef",
    "shortName",
    "summary",
    "libraryType",
    "operationalStatus",
    "city",
    "featured",
    "continent_slug",
    "continent_name",
    "country_slug",
    "country_name",
    "region_slug",
    "region_name",
    "foundedYear",
    "operatorType",
    "heroImage",
    "openingTimes",
    "timezone",
    "iiifEndpoint",
    "accessibility_names",
    "service_names",
    "_geo",
    "source",
  ],
  event: [
    "id",
    "documentId",
    "title",
    "summary",
    "url",
    "imageUrl",
    "startTime",
    "endTime",
    "allDay",
    "timezone",
    "eventType",
    "sourceProvider",
    "isFree",
    "priceMin",
    "priceMax",
    "status",
    "startTimestamp",
    "library_name",
    "library_slug",
    "library_city",
    "library_country_code",
    "library_country_slug",
    "library_country_name",
    "library_continent_slug",
    "library_region_slug",
  ],
}

/** A private user-profile row, as `populate: "*"` would copy it. */
const PROFILE = {
  id: 7,
  documentId: "prof-1",
  username: "alex",
  baUserId: "ba_123",
  firstName: "Alex",
  lastName: "Bennett",
  notifPrefs: { digest: true },
  publicPrefs: { showActivity: false },
  earnedProUntil: "2027-01-01T00:00:00.000Z",
}

const ADMIN = { id: 1, firstName: "Root", lastName: "Admin", email: "root@x" }

const MEDIA = {
  id: 3,
  url: "/uploads/hero.jpg",
  alternativeText: "Reading room",
  formats: { small: { url: "/uploads/small_hero.jpg" } },
  hash: "hero_abc",
  provider: "local",
  provider_metadata: { bucket: "private" },
}

/**
 * Fully populated fixtures: every field the raw entry could carry, including
 * the private ones. `_geo` needs a valid location, so the library has one.
 */
const FIXTURES: Record<IndexName, Record<string, unknown>> = {
  "blog-article": {
    id: 11,
    documentId: "blog-1",
    locale: "en",
    title: "Hello",
    slug: "hello",
    summary: "A post",
    author: "A. Writer",
    authorTitle: "Editor",
    authorBio: "Private-ish bio",
    authorAvatar: MEDIA,
    body: [{ __component: "blocks.rich-text", body: "..." }],
    featured: true,
    heroImage: MEDIA,
    section: { id: 1, slug: "news", name: "News", description: "d" },
    category: { id: 2, slug: "opinion", name: "Opinion" },
    contributors: [PROFILE],
    createdBy: ADMIN,
    updatedBy: ADMIN,
    publishedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  "wiki-article": {
    id: 12,
    documentId: "wiki-1",
    locale: "en",
    title: "How to",
    slug: "how-to",
    summary: "A guide",
    author: "A. Writer",
    body: [{ __component: "blocks.rich-text", body: "..." }],
    featured: false,
    priority: 3,
    articleStatus: "published",
    docsSections: { a: 1 },
    heroImage: MEDIA,
    section: { id: 1, slug: "guides", name: "Guides", label: "G" },
    category: { id: 2, slug: "data", name: "Data" },
    contributors: [PROFILE],
    createdBy: ADMIN,
    updatedBy: ADMIN,
    publishedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
  library: {
    id: 13,
    documentId: "lib-1",
    locale: "en",
    name: "British Library",
    slug: "british-library",
    entityRef: "GB-BL-001",
    shortName: "BL",
    alternateNames: ["The BL"],
    summary: "National library",
    description: [{ type: "paragraph", children: [] }],
    libraryType: "National",
    operatorType: "National Government",
    operationalStatus: "open",
    foundedYear: "1973",
    city: "London",
    district: "St Pancras",
    streetAddress: "96 Euston Rd",
    postalCode: "NW1 2DB",
    email: "info@bl.uk",
    phone: "+44",
    website: "https://bl.uk",
    featured: true,
    timezone: "Europe/London",
    openingTimes: {
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [{ startTime: "09:30", endTime: "20:00" }],
        },
      ],
    },
    completeness: 63,
    gaps: ["accessibility"],
    source: "wikidata",
    createdAt: "2026-08-01T00:00:00.000Z",
    lastVerifiedAt: "2026-10-03T00:00:00.000Z",
    verifiedSections: {
      hours: "2026-10-02T00:00:00.000Z",
      status: "2026-10-02T00:00:00.000Z",
      address: "2026-10-02T00:00:00.000Z",
      contact: "2026-10-02T00:00:00.000Z",
    },
    iiifEndpoint: "https://iiif.bl.uk",
    location: { lat: "51.53", lng: "-0.127" },
    heroImage: MEDIA,
    gallery: [MEDIA],
    continent: { id: 1, slug: "europe", name: "Europe" },
    country: {
      id: 2,
      slug: "united-kingdom",
      name: "United Kingdom",
      iso2: "gb",
    },
    region: { id: 3, slug: "london", name: "London" },
    area: { id: 4, slug: "camden", name: "Camden" },
    accessibility: [{ id: 1, name: "Step-free access" }],
    services: [{ id: 2, name: "Wi-Fi" }],
    amenities: [{ id: 3, name: "Café" }],
    sourceRecords: [{ provider: "x", externalId: "y" }],
    createdBy: ADMIN,
    updatedBy: ADMIN,
    publishedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
  event: {
    id: 14,
    documentId: "ev-1",
    externalId: "eb-999",
    sourceProvider: "eventbrite",
    credentialId: 5,
    syncHash: "deadbeef",
    title: "Talk",
    description: "Long description",
    summary: "Short",
    url: "https://example.org/e",
    imageUrl: "https://example.org/i.jpg",
    startTime: "2026-10-01T10:00:00.000Z",
    endTime: "2026-10-01T11:00:00.000Z",
    allDay: false,
    timezone: "Europe/London",
    eventType: "talk",
    audience: ["adults"],
    tags: ["x"],
    isFree: true,
    priceMin: null,
    priceMax: null,
    capacity: 40,
    status: "scheduled",
    pendingReview: false,
    importedAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-09-02T00:00:00.000Z",
    library: {
      id: 13,
      documentId: "lib-1",
      name: "British Library",
      slug: "british-library",
      city: "London",
      email: "info@bl.uk",
      phone: "+44",
      country: { slug: "united-kingdom", name: "United Kingdom", iso2: "gb" },
      continent: { slug: "europe", name: "Europe" },
      region: { slug: "london", name: "London" },
    },
    publishedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
}

function env(key: string, fallback?: unknown) {
  if (key === "NODE_ENV") return "test"

  return fallback
}
env.array = (_key: string, fallback: unknown[] = []) => fallback
env.bool = (_key: string, fallback = false) => fallback
env.int = (_key: string, fallback = 0) => fallback

/** Every populate node, at any depth, as [path, node]. */
function walkPopulate(
  populate: Record<string, PopulateNode> | undefined,
  prefix = ""
): [string, PopulateNode][] {
  if (!populate) return []

  return Object.entries(populate).flatMap(([key, node]) => [
    [`${prefix}${key}`, node] as [string, PopulateNode],
    ...walkPopulate(node.populate, `${prefix}${key}.`),
  ])
}

let meili: Record<string, IndexConfig>

beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
  const config = pluginsConfig({ env }) as {
    meilisearch: { config: Record<string, IndexConfig> }
  }
  meili = config.meilisearch.config
})

describe.each(INDEXES)("Meilisearch index %s", (name) => {
  it("fetches an explicit field list that keeps what the plugin needs", () => {
    const fields = meili[name].entriesQuery?.fields
    expect(Array.isArray(fields)).toBe(true)
    expect(fields).toContain("documentId")
    expect(fields).toContain("publishedAt")
    if (LOCALIZED.has(name)) expect(fields).toContain("locale")
    for (const key of LEAK_KEYS) expect(fields).not.toContain(key)
  })

  it("populates every relation with an explicit field list", () => {
    const populate = meili[name].entriesQuery?.populate
    expect(populate).toBeTypeOf("object")
    const nodes = walkPopulate(populate)
    expect(nodes.length).toBeGreaterThan(0)
    for (const [path, node] of nodes) {
      expect(Array.isArray(node.fields), `${path} has no fields`).toBe(true)
      expect(
        (node.fields as string[]).length,
        `${path} is empty`
      ).toBeGreaterThan(0)
    }
  })

  it("never populates contributors beyond the username", () => {
    const contributors = meili[name].entriesQuery?.populate?.contributors
    if (contributors) expect(contributors.fields).toEqual(["username"])
  })

  it("lists displayedAttributes without private fields", () => {
    const displayed = meili[name].settings.displayedAttributes
    expect(Array.isArray(displayed)).toBe(true)
    expect(displayed!.length).toBeGreaterThan(0)
    for (const key of LEAK_KEYS) expect(displayed).not.toContain(key)
  })

  it("displays everything the UI retrieves, filters or sorts on", () => {
    const displayed = meili[name].settings.displayedAttributes ?? []
    for (const key of UI_READS[name]) expect(displayed).toContain(key)
    const {
      searchableAttributes = [],
      filterableAttributes = [],
      sortableAttributes = [],
    } = meili[name].settings
    for (const key of [
      ...searchableAttributes,
      ...filterableAttributes,
      ...sortableAttributes,
    ])
      expect(displayed, `${key} is used but not displayed`).toContain(key)
  })

  it("transformEntry builds the document from an allowlist", async () => {
    const transform = meili[name].transformEntry
    expect(transform).toBeTypeOf("function")
    const doc = await transform!({ entry: structuredClone(FIXTURES[name]) })
    const displayed = meili[name].settings.displayedAttributes ?? []

    // Exactly the displayed keys: nothing extra, nothing missing. The
    // opening-hours fields are sparse (only real timeframes are stored).
    const isOpen = (key: string) => /^open_[a-z]{3}_\d_(from|to)$/.test(key)
    expect(
      Object.keys(doc)
        .filter((k) => !isOpen(k))
        .sort()
    ).toEqual(displayed.filter((k) => !isOpen(k)).sort())
    for (const key of Object.keys(doc).filter(isOpen))
      expect(displayed).toContain(key)

    // Nothing private survives anywhere in the document, nested included.
    const serialised = JSON.stringify(doc)
    for (const key of LEAK_KEYS) expect(serialised).not.toContain(`"${key}"`)
    expect(serialised).not.toContain("ba_123")
    expect(serialised).not.toContain("root@x")
    expect(serialised).not.toContain("info@bl.uk")
    expect(serialised).not.toContain("provider_metadata")

    // The plugin derives _meilisearch_id from these after the transform.
    expect(doc.documentId).toBe(FIXTURES[name].documentId)
    if (LOCALIZED.has(name)) expect(doc.locale).toBe("en")
  })
})

describe("Meilisearch indexes every locale", () => {
  // strapi-plugin-meilisearch passes `entriesQuery.locale` straight to the
  // Strapi 5 Document Service, which only understands "*" as "every locale"
  // ("all" is the Strapi 4 i18n spelling and matches no rows in v5).
  it.each([...LOCALIZED])("%s fetches every locale", (name) => {
    expect(meili[name].entriesQuery?.locale).toBe("*")
  })

  it.each([...LOCALIZED])("%s can filter and display by locale", (name) => {
    expect(meili[name].settings.filterableAttributes).toContain("locale")
    expect(meili[name].settings.displayedAttributes).toContain("locale")
  })

  it("leaves the non-localized event index alone", () => {
    expect(meili.event.entriesQuery?.locale).toBeUndefined()
  })

  it("runs a plugin whose live sync understands the * locale", () => {
    // 0.16.0's document middleware re-read every created, updated or
    // published entry with findOne({ locale: "*" }), which Strapi 5 answers
    // with null, and then deleted the entry from the index. 0.16.5 resolves
    // the wildcard to the edited locale.
    const { version } = JSON.parse(
      readFileSync(
        new URL(
          "../node_modules/strapi-plugin-meilisearch/package.json",
          import.meta.url
        ),
        "utf8"
      )
    ) as { version: string }
    const [major, minor, patch] = version.split(".").map(Number)
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(16_005)
  })
})

describe("Meilisearch transforms keep their derived fields", () => {
  it("library: flattened location, facet arrays and _geo", async () => {
    const doc = await meili.library.transformEntry!({
      entry: structuredClone(FIXTURES.library),
    })
    expect(doc).toMatchObject({
      continent_slug: "europe",
      continent_name: "Europe",
      country_slug: "united-kingdom",
      country_name: "United Kingdom",
      region_slug: "london",
      region_name: "London",
      accessibility_names: ["Step-free access"],
      service_names: ["Wi-Fi"],
      _geo: { lat: 51.53, lng: -0.127 },
      heroImage: {
        url: "/uploads/hero.jpg",
        formats: { small: { url: "/uploads/small_hero.jpg" } },
      },
    })
  })

  it("carries the country's Region labels into library documents", async () => {
    const libraryTransform = meili.library.transformEntry!
    const doc = await libraryTransform({
      entry: {
        name: "Bern Public Library",
        country: {
          iso2: "CH",
          slug: "switzerland",
          name: "Switzerland",
          regionTypeLabel: "Canton",
          regionsSectionLabel: "Cantons",
        },
      },
    })
    expect(doc.country_region_label).toBe("Canton")
    expect(doc.country_regions_label).toBe("Cantons")

    const countryPopulate = meili.library.entriesQuery?.populate?.country
    expect(countryPopulate?.fields).toContain("regionTypeLabel")
    expect(countryPopulate?.fields).toContain("regionsSectionLabel")

    const displayed = meili.library.settings.displayedAttributes ?? []
    expect(displayed).toContain("country_region_label")
    expect(displayed).toContain("country_regions_label")
  })

  it("library: omits _geo without a usable location", () => {
    const entry = structuredClone(FIXTURES.library)
    entry.location = { lat: "n/a", lng: null }
    const doc = meili.library.transformEntry!({ entry })
    expect(doc).not.toHaveProperty("_geo")
  })

  it("articles: section and category flattened", () => {
    const blog = meili["blog-article"].transformEntry!({
      entry: structuredClone(FIXTURES["blog-article"]),
    })
    expect(blog).toMatchObject({ section_slug: "news", section_name: "News" })
    const wiki = meili["wiki-article"].transformEntry!({
      entry: structuredClone(FIXTURES["wiki-article"]),
    })
    expect(wiki).toMatchObject({
      section_slug: "guides",
      section_name: "Guides",
      category_slug: "data",
      category_name: "Data",
    })
  })

  it("events: library denormalised and startTimestamp in unix seconds", () => {
    const doc = meili["event"].transformEntry!({
      entry: structuredClone(FIXTURES["event"]),
    })
    expect(doc).toMatchObject({
      library_name: "British Library",
      library_slug: "british-library",
      library_city: "London",
      library_country_code: "GB",
      library_country_slug: "united-kingdom",
      library_country_name: "United Kingdom",
      library_continent_slug: "europe",
      library_region_slug: "london",
      startTimestamp: Math.floor(Date.parse("2026-10-01T10:00:00.000Z") / 1000),
    })
    expect(doc).not.toHaveProperty("library")
  })
})

describe("Meilisearch config keys", () => {
  // strapi-plugin-meilisearch resolves per-type config through
  // `strapi.contentTypes[uid].modelName` (= the schema's `singularName`),
  // never the UID — a key like "plugin::events.event" silently matches
  // nothing and the index falls back to populate "*" with no settings.
  const schemas: Record<IndexName, string> = {
    "blog-article":
      "src/api/blog-article/content-types/blog-article/schema.json",
    "wiki-article":
      "src/api/wiki-article/content-types/wiki-article/schema.json",
    library: "src/api/library/content-types/library/schema.json",
    event: "src/plugins/events/server/content-types/event/schema.json",
  }

  it("configures exactly the known indexes and nothing keyed by UID", () => {
    const keys = Object.keys(meili).filter(
      (k) => !["host", "apiKey"].includes(k)
    )
    expect(keys.sort()).toEqual([...INDEXES].sort())
    for (const key of keys) expect(key).not.toMatch(/::/)
  })

  it.each(INDEXES)("%s is that content type's singularName", (key) => {
    const schema = JSON.parse(
      readFileSync(new URL(`../${schemas[key]}`, import.meta.url), "utf8")
    ) as { info: { singularName: string } }
    expect(schema.info.singularName).toBe(key)
  })
})

describe("library index serves drives", () => {
  it("filters on what drive scopes and gaps need", () => {
    const {
      filterableAttributes = [],
      sortableAttributes = [],
      searchableAttributes = [],
    } = meili.library.settings
    for (const key of [
      "completeness",
      "id",
      "source",
      "created_ts",
      "last_verified_ts",
      "verified_hours_ts",
      "verified_status_ts",
      "verified_address_ts",
      "verified_contact_ts",
      "needs",
      "area_slug",
      "documentId",
    ])
      expect(filterableAttributes).toContain(key)
    expect(sortableAttributes).toContain("id")
    expect(searchableAttributes).toContain("area_name")
  })
})

describe("scripts/seed-meilisearch.ts", () => {
  // The seed imports config/plugins.ts, so the index shapes have one source.
  let seed: typeof SeedModule
  const libraryQuery = () =>
    seed.seededIndexes().find((i) => i.name === "library")!.entriesQuery

  beforeAll(async () => {
    seed = await import("../scripts/seed-meilisearch")
  })

  it("seeds the library and article indexes from the plugin config", () => {
    const indexes = seed.seededIndexes()
    expect(indexes.map((i) => i.name)).toEqual([
      "library",
      "blog-article",
      "wiki-article",
    ])
    for (const index of indexes) {
      expect(index.settings).toEqual(meili[index.name].settings)
      expect(index.entriesQuery).toEqual(meili[index.name].entriesQuery)
    }
  })

  it("builds the plugin's document id, with the locale only when present", () => {
    // strapi-plugin-meilisearch: `[collection]-[documentId]` plus `-[locale]`
    // for localized entries; the seeded and hook-written documents must share
    // the primary key or every publish adds a duplicate.
    expect(
      seed.meilisearchId("library", { documentId: "lib-1", locale: "en" })
    ).toBe("library-lib-1-en")
    expect(seed.meilisearchId("event", { documentId: "ev-1" })).toBe(
      "event-ev-1"
    )
    expect(
      seed.meilisearchId("event", { documentId: "ev-1", locale: null })
    ).toBe("event-ev-1")
  })

  it("library: the core list route returns every field the seed reads", () => {
    // The seed reads `/api/libraries`, whose `library-populate` middleware
    // swaps the query's fields and populate for LIBRARY_SHAPES.list. Whatever
    // the seed asks for that the shape leaves out comes back missing, and a
    // missing `locale` hides every library from the locale-filtered search.
    const { fields, populate } = libraryQuery()
    const shape = LIBRARY_SHAPES.list
    // `mobileTimetable` is the one derive-only field the list shape leaves
    // out (1.8); the seed fills it from the timetable route (next test).
    expect(
      fields.filter((f) => f !== "documentId" && !shape.fields.includes(f))
    ).toEqual(["mobileTimetable"])
    const missing = Object.entries(populate).flatMap(([relation, node]) => {
      const shaped = shape.populate[relation] as
        | { fields?: string[] }
        | undefined
      if (!shaped) return [relation]

      return node.fields
        .filter((f) => !shaped.fields?.includes(f))
        .map((f) => `${relation}.${f}`)
    })
    expect(missing).toEqual([])
  })

  it("library: fills a Mobile entry's timetable from its timetable route, once per vehicle", async () => {
    const entries: Record<string, unknown>[] = [
      { documentId: "m1", locale: "en", libraryType: "Mobile" },
      { documentId: "m1", locale: "fr", libraryType: "Mobile" },
      { documentId: "b1", locale: "en", libraryType: "Public" },
    ]
    const get = vi.fn(async () => ({ timetable: { version: 1 } }))
    await seed.attachMobileTimetables(entries, get)
    expect(get).toHaveBeenCalledExactlyOnceWith("/api/mobile/m1/timetable")
    expect(entries[0]!.mobileTimetable).toEqual({ version: 1 })
    expect(entries[1]!.mobileTimetable).toEqual({ version: 1 })
    expect(entries[2]).not.toHaveProperty("mobileTimetable")
    const missing = vi.fn(async () => null)
    await seed.attachMobileTimetables([entries[0]!], missing)
    expect(entries[0]!.mobileTimetable).toBeNull()
  })

  it("asks REST for exactly the configured fields and populate", () => {
    const params = seed.entriesQueryParams(libraryQuery(), 2)
    expect(params.get("status")).toBe("published")
    expect(params.get("locale")).toBe("*")
    expect(params.get("pagination[page]")).toBe("2")
    expect(params.getAll("fields[0]")).toEqual(["documentId"])
    expect(params.get("populate[country][fields][0]")).toBe("iso2")
    expect(params.get("populate[contributors][fields][0]")).toBeNull()
    expect(
      [...params.keys()].some(
        (k) => k.startsWith("populate[") && !k.includes("[fields]")
      )
    ).toBe(false)
  })
})
