/**
 * Server-owned `fields` and `populate` shapes for the core REST routes of the
 * location hierarchy and libraries (E5). The route middlewares in
 * `api/<name>/middlewares/<name>-populate.ts` replace whatever the client
 * asked for with these, so a `populate=*` (or a populate of `createdBy`)
 * can never widen a response beyond what the pages need.
 *
 * Every media, relation and component entry carries explicit `fields`.
 */

export const MEDIA_FIELDS = [
  "url",
  "alternativeText",
  "width",
  "height",
  "formats",
]

export const mediaPopulate = { fields: MEDIA_FIELDS }

export const MAP_CONFIG_POPULATE = {
  fields: [
    "centerLat",
    "centerLng",
    "defaultZoom",
    "boundingBoxNE",
    "boundingBoxSW",
    "mapStyle",
  ],
}

export const SEO_POPULATE = {
  fields: [
    "metaTitle",
    "metaDescription",
    "keywords",
    "metaRobots",
    "metaViewport",
    "canonicalURL",
    "structuredData",
  ],
  populate: {
    metaImage: mediaPopulate,
    openGraph: {
      fields: ["ogTitle", "ogDescription", "ogUrl", "ogType"],
      populate: { ogImage: mediaPopulate },
    },
  },
}

const continentRef = { fields: ["name", "slug", "code"] }
const locationRef = { fields: ["name", "slug"] }
const optionRef = { fields: ["name", "category", "icon"] }

/** A featured library card on a continent, country or region page. */
export const FEATURED_LIBRARY_POPULATE = {
  fields: [
    "name",
    "slug",
    "entityRef",
    "shortName",
    "summary",
    "libraryType",
    "operationalStatus",
    "city",
    "featured",
  ],
  populate: {
    heroImage: mediaPopulate,
    continent: continentRef,
    country: locationRef,
    region: locationRef,
  },
}

type Shape = { fields: string[]; populate: Record<string, unknown> }

export type ShapeSet = { list: Shape; detail: Shape }

// ── Library ─────────────────────────────────────────────────────────────────

// `locale`, `iiifEndpoint` and the country's `iso2` are here for
// scripts/seed-meilisearch.mjs, which reads this route to build the search
// index (parity-tested in tests/meilisearch-config.test.ts); `sourceRecords`
// is for the ingests, which skip outlets they already created.
const LIBRARY_LIST_FIELDS = [
  "locale",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "libraryType",
  "operatorType",
  "operationalStatus",
  "city",
  "district",
  "streetAddress",
  "postalCode",
  "location",
  "timezone",
  "openingTimes",
  "website",
  "phone",
  "email",
  "foundedYear",
  "openedYear",
  "closedYear",
  "featured",
  "hasActiveFeed",
  "completeness",
  "gaps",
  "lastVerifiedAt",
  "contentUpdatedAt",
  "iiifEndpoint",
  "updatedAt",
  "publishedAt",
]

const LIBRARY_LIST_POPULATE = {
  heroImage: mediaPopulate,
  continent: continentRef,
  country: {
    fields: ["name", "slug", "iso2", "regionTypeLabel", "regionsSectionLabel"],
  },
  region: locationRef,
  area: locationRef,
  accessibility: optionRef,
  services: optionRef,
  amenities: optionRef,
  collectionStats: { fields: ["value", "category", "description"] },
  sourceRecords: { fields: ["dataset", "recordId", "retrievedAt", "url"] },
}

export const LIBRARY_SHAPES: ShapeSet = {
  list: { fields: LIBRARY_LIST_FIELDS, populate: LIBRARY_LIST_POPULATE },
  detail: {
    fields: [
      ...LIBRARY_LIST_FIELDS,
      "alternateNames",
      "description",
      "catalogueUrl",
      "membershipUrl",
      "bookingUrl",
      "planVisitUrl",
      "virtualTourUrl",
      "donationUrl",
      "closureReason",
      "visitNotes",
      "admissionInfo",
      "accessibilityNotes",
      "absentFacilities",
      "virtualTourEmbed",
      "architect",
      "buildingInfo",
      "languagesServed",
      "classificationSystem",
      "transitInfo",
      "nearestStation",
      "wikidataId",
      "source",
      "sourceUrl",
    ],
    populate: {
      ...LIBRARY_LIST_POPULATE,
      gallery: mediaPopulate,
      socialLinks: { fields: ["platform", "label", "url"] },
      libraryStats: { fields: ["value", "label", "note"] },
      seo: SEO_POPULATE,
    },
  },
}

// ── Continent ───────────────────────────────────────────────────────────────

const CONTINENT_FIELDS = [
  "name",
  "slug",
  "code",
  "summary",
  "sourceAttribution",
  "updatedAt",
  "publishedAt",
]

export const CONTINENT_SHAPES: ShapeSet = {
  list: {
    fields: CONTINENT_FIELDS,
    populate: { mapConfig: MAP_CONFIG_POPULATE },
  },
  detail: {
    fields: [...CONTINENT_FIELDS, "about"],
    populate: {
      mapConfig: MAP_CONFIG_POPULATE,
      countries: {
        fields: ["name", "slug", "iso2", "capitalCity", "summary"],
        populate: { mapConfig: MAP_CONFIG_POPULATE },
      },
      featuredLibraries: FEATURED_LIBRARY_POPULATE,
      seo: SEO_POPULATE,
    },
  },
}

// ── Country ─────────────────────────────────────────────────────────────────

const COUNTRY_FIELDS = [
  "name",
  "slug",
  "entityRef",
  "shortName",
  "iso2",
  "iso3",
  "capitalCity",
  "regionTypeLabel",
  "regionsSectionLabel",
  "areaTypeLabel",
  "areasSectionLabel",
  "summary",
  "heroTagline",
  "featured",
  "sourceAttribution",
  "updatedAt",
  "publishedAt",
]

export const COUNTRY_SHAPES: ShapeSet = {
  list: {
    fields: COUNTRY_FIELDS,
    populate: {
      continent: continentRef,
      heroImage: mediaPopulate,
      mapConfig: MAP_CONFIG_POPULATE,
    },
  },
  detail: {
    fields: [
      ...COUNTRY_FIELDS,
      "about",
      "population",
      "languages",
      "systemDescription",
      "budget",
      "employees",
      "volunteers",
      "visitsPerYear",
    ],
    populate: {
      continent: continentRef,
      heroImage: mediaPopulate,
      mapConfig: MAP_CONFIG_POPULATE,
      regions: {
        fields: ["name", "slug", "summary", "typeLabel"],
        populate: { mapConfig: MAP_CONFIG_POPULATE },
      },
      nationalLibrary: {
        fields: ["name", "slug", "summary", "libraryType", "operationalStatus"],
        populate: { heroImage: mediaPopulate },
      },
      featuredLibraries: FEATURED_LIBRARY_POPULATE,
      seo: SEO_POPULATE,
    },
  },
}

// ── Region ──────────────────────────────────────────────────────────────────

const REGION_FIELDS = [
  "name",
  "slug",
  "entityRef",
  "geonamesId",
  "shortName",
  "typeLabel",
  "areaTypeLabel",
  "areasSectionLabel",
  "summary",
  "heroTagline",
  "featured",
  "sourceAttribution",
  "population",
  "populationYear",
  "populationSource",
  "updatedAt",
  "publishedAt",
]

export const REGION_SHAPES: ShapeSet = {
  list: {
    fields: REGION_FIELDS,
    populate: {
      continent: continentRef,
      country: locationRef,
      heroImage: mediaPopulate,
      mapConfig: MAP_CONFIG_POPULATE,
    },
  },
  detail: {
    fields: REGION_FIELDS,
    populate: {
      continent: continentRef,
      country: {
        fields: [
          "name",
          "slug",
          "capitalCity",
          "regionTypeLabel",
          "regionsSectionLabel",
          "areaTypeLabel",
          "areasSectionLabel",
        ],
        populate: { continent: continentRef },
      },
      heroImage: mediaPopulate,
      mapConfig: MAP_CONFIG_POPULATE,
      areas: { fields: ["name", "slug", "summary", "typeLabel"] },
      featuredLibraries: FEATURED_LIBRARY_POPULATE,
      seo: SEO_POPULATE,
    },
  },
}

// ── Area ────────────────────────────────────────────────────────────────────

const AREA_FIELDS = [
  "name",
  "slug",
  "entityRef",
  "geonamesId",
  "gssCode",
  "sourceAttribution",
  "shortName",
  "typeLabel",
  "summary",
  "updatedAt",
  "publishedAt",
]

export const AREA_SHAPES: ShapeSet = {
  list: {
    fields: AREA_FIELDS,
    populate: {
      region: locationRef,
      country: locationRef,
      mapConfig: MAP_CONFIG_POPULATE,
    },
  },
  detail: {
    fields: AREA_FIELDS,
    populate: {
      region: {
        fields: ["name", "slug", "typeLabel"],
        populate: {
          country: {
            fields: [
              "name",
              "slug",
              "regionTypeLabel",
              "regionsSectionLabel",
              "areaTypeLabel",
              "areasSectionLabel",
            ],
            populate: { continent: continentRef },
          },
        },
      },
      country: locationRef,
      mapConfig: MAP_CONFIG_POPULATE,
    },
  },
}

export type PopulateView = "list" | "detail"

/**
 * The route-middleware body shared by the five `<name>-populate`
 * middlewares: overwrite `fields` and `populate` with the server shape for
 * the configured view, leave filters, sort, locale, status and pagination as
 * the client sent them.
 */
export function applyPopulateShape(
  ctx: { query?: Record<string, unknown> },
  shapes: ShapeSet,
  config: { view?: PopulateView } | undefined
): void {
  const shape = shapes[config?.view === "detail" ? "detail" : "list"]
  ctx.query = {
    ...ctx.query,
    fields: [...shape.fields],
    populate: structuredClone(shape.populate),
  }
}
