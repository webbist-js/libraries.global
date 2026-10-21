import {
  DRIVE_MAX_TASKS,
  libraryTypeName,
  eventTimeSlot,
  type LibraryNotice,
} from "@repo/shared-data"

import {
  articleSearchFacets,
  ARTICLE_BROWSE_POPULATE,
  JOURNAL_BROWSE_POPULATE,
} from "../src/utils/article-browse"
import { discussionsHostConfig } from "../src/utils/discussions-host"
import { noticesForIndexing } from "../src/utils/library-notices"
import {
  OPEN_FIELD_NAMES,
  TIMESTAMP_FIELD_NAMES,
  librarySearchFields,
} from "../src/utils/library-search-fields"
import { scrubSentryEvent } from "../src/utils/sentry-scrub"

export default ({ env }) => {
  const awsS3Config = prepareAwsS3Config(env)
  if (!awsS3Config) {
    console.warn(
      "AWS S3 upload configuration is not complete. Local file storage will be used."
    )
  }

  return {
    discussions: {
      enabled: true,
      config: discussionsHostConfig,
    },
    upload: {
      config: {
        ...(awsS3Config ?? localUploadConfig),
        // Content-sniffed by Strapi. Deny types that execute in the browser
        // when served from our origin (stored XSS via uploads).
        security: {
          deniedTypes: [
            "text/html",
            "application/xhtml+xml",
            "image/svg+xml",
            "application/javascript",
            "text/javascript",
            "application/x-sh",
            "application/x-msdownload",
          ],
        },
      },
    },

    "config-sync": {
      enabled: true,
    },

    // Every index is read by the browser with the public search key, so each
    // entry declares exactly what it fetches (`entriesQuery`), builds its
    // document from an allowlist (`transformEntry`) and tells Meilisearch
    // which attributes it may ever return (`displayedAttributes`). Never
    // spread `...entry`: with the plugin's default `populate: "*"` that copies
    // contributor user-profiles and admin users into the public index.
    meilisearch: {
      enabled: true,
      config: {
        host: env("MEILISEARCH_HOST", "http://localhost:7700"),
        apiKey: env("MEILISEARCH_ADMIN_API_KEY", ""),
        "blog-article": {
          settings: {
            searchableAttributes: [
              "title",
              "summary",
              "author",
              "section_name",
            ],
            filterableAttributes: ARTICLE_FILTERABLE,
            displayedAttributes: ARTICLE_DISPLAYED,
          },
          entriesQuery: {
            fields: [...ARTICLE_FIELDS, "publicationOrigin"],
            populate: JOURNAL_ARTICLE_POPULATE,
            locale: ALL_LOCALES,
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return articleDocument(entry, "blog")
          },
        },

        "wiki-article": {
          settings: {
            searchableAttributes: [
              "title",
              "summary",
              "section_name",
              "category_name",
            ],
            filterableAttributes: [...ARTICLE_FILTERABLE, "category_slug"],
            displayedAttributes: ARTICLE_DISPLAYED,
          },
          entriesQuery: {
            fields: [...ARTICLE_FIELDS, "docsSections"],
            populate: ARTICLE_POPULATE,
            locale: ALL_LOCALES,
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return articleDocument(entry, "wiki")
          },
        },

        // Events — plugin content type; denormalise library location for geo/text search.
        // Keyed by the schema's `singularName`: strapi-plugin-meilisearch resolves
        // per-type config through `contentTypes[uid].modelName`, never the UID.
        event: {
          settings: {
            pagination: { maxTotalHits: 100_000 },
            searchableAttributes: [
              "title",
              "summary",
              "library_name",
              "library_city",
              "library_country_name",
            ],
            filterableAttributes: [
              "eventType",
              "timeSlot",
              "isFree",
              "status",
              "startTimestamp",
              "library_country_code",
              "library_country_slug",
              "library_continent_slug",
              "library_region_slug",
            ],
            sortableAttributes: ["startTimestamp"],
            displayedAttributes: EVENT_DISPLAYED,
          },
          entriesQuery: {
            // Events have no publishedAt: the plugin’s generic publication gate
            // must defer to the explicit event visibility predicate below.
            status: "draft",
            fields: [...EVENT_FIELDS, "pendingReview"],
            populate: {
              library: {
                fields: ["name", "slug", "city"],
                populate: {
                  country: { fields: ["iso2", "slug", "name"] },
                  continent: { fields: ["slug", "name"] },
                  region: { fields: ["slug", "name"] },
                },
              },
            },
          },
          filterEntry({ entry }: { entry: Record<string, unknown> }) {
            return (
              entry.pendingReview === false &&
              (entry.status === "upcoming" || entry.status === "ongoing")
            )
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const library = asRecord(entry.library)
            const country = asRecord(library?.country)
            const continent = asRecord(library?.continent)
            const region = asRecord(library?.region)

            return {
              ...pick(entry, EVENT_DOC_KEYS),
              timeSlot: eventTimeSlot(entry),
              library_name: library?.name ?? null,
              library_slug: library?.slug ?? null,
              library_city: library?.city ?? null,
              library_country_code: countryCode(country?.iso2),
              library_country_slug: country?.slug ?? null,
              library_country_name: country?.name ?? null,
              library_continent_slug: continent?.slug ?? null,
              library_region_slug: region?.slug ?? null,
              // Unix seconds for range filtering on startTime
              startTimestamp: entry.startTime
                ? Math.floor(
                    new Date(entry.startTime as string).getTime() / 1000
                  )
                : null,
            }
          },
        },

        library: {
          settings: {
            // Every task in a drive (up to 2,000) must remain reachable by pagination.
            pagination: { maxTotalHits: DRIVE_MAX_TASKS },
            searchableAttributes: [
              "name",
              "shortName",
              "summary",
              "city",
              "district",
              "country_name",
              "region_name",
              "area_name",
            ],
            filterableAttributes: [
              "libraryType",
              "operationalStatus",
              "continent_slug",
              "country_slug",
              "region_slug",
              "area_slug",
              "featured",
              "accessibility_names",
              "service_names",
              "operatorType",
              "_geo",
              "locale",
              "completeness",
              "id",
              "documentId",
              "entityRef",
              "source",
              ...LIBRARY_SEARCH_FIELDS,
            ],
            sortableAttributes: [
              "name",
              "featured",
              "completeness",
              "_geo",
              "id",
            ],
            displayedAttributes: LIBRARY_DISPLAYED,
            // geo_cell counts libraries per 1° cell for the homepage globe:
            // densest cells first, and room for every inhabited cell.
            faceting: {
              maxValuesPerFacet: 5000,
              sortFacetValuesBy: { "*": "alpha", geo_cell: "count" },
            },
          },
          entriesQuery: {
            fields: LIBRARY_FIELDS,
            locale: ALL_LOCALES,
            populate: {
              libraryType: { fields: ["name"] },
              sourceRecords: { fields: ["dataset", "role"] },
              continent: { fields: ["slug", "name"] },
              country: {
                fields: [
                  "iso2",
                  "slug",
                  "name",
                  "regionTypeLabel",
                  "regionsSectionLabel",
                  "areaTypeLabel",
                  "areasSectionLabel",
                ],
              },
              region: {
                fields: ["slug", "name", "areaTypeLabel", "areasSectionLabel"],
              },
              area: { fields: ["slug", "name"] },
              accessibility: { fields: ["name"] },
              services: { fields: ["name"] },
              amenities: { fields: ["name"] },
              heroImage: { fields: MEDIA_FIELDS },
            },
          },
          // Flatten nested relations so they are searchable/filterable,
          // and map the location custom field to MeiliSearch's _geo format.
          async transformEntry({
            entry,
            notices: given,
          }: {
            entry: Record<string, unknown>
            /** The seed script passes the notices it fetched over REST. */
            notices?: LibraryNotice[]
          }) {
            const continent = asRecord(entry.continent)
            const country = asRecord(entry.country)
            const region = asRecord(entry.region)
            const area = asRecord(entry.area)
            const location = asRecord(entry.location)
            const lat = coordinate(location?.lat)
            const lng = coordinate(location?.lng)
            // Inside Strapi the loader answers a reindex batch with one query
            // per 100 libraries; outside it (tests) a library has none.
            const notices =
              given ??
              (typeof strapi !== "undefined" &&
              typeof entry.documentId === "string"
                ? await noticesForIndexing(strapi, entry.documentId)
                : [])

            return {
              ...pick(entry, LIBRARY_DOC_KEYS),
              libraryType: libraryTypeName(entry.libraryType),
              heroImage: mediaSummary(entry.heroImage),
              continent_slug: continent?.slug ?? null,
              continent_name: continent?.name ?? null,
              country_slug: country?.slug ?? null,
              country_name: country?.name ?? null,
              country_code: countryCode(country?.iso2),
              // What the country calls its Regions, for Find libraries' filter.
              country_region_label: str(country?.regionTypeLabel),
              country_regions_label: str(country?.regionsSectionLabel),
              country_area_label: str(country?.areaTypeLabel),
              country_areas_label: str(country?.areasSectionLabel),
              region_slug: region?.slug ?? null,
              region_name: region?.name ?? null,
              region_area_label: str(region?.areaTypeLabel),
              region_areas_label: str(region?.areasSectionLabel),
              area_slug: area?.slug ?? null,
              area_name: area?.name ?? null,
              // Flat arrays for checkbox filters in the UI
              accessibility_names: optionNames(entry.accessibility),
              service_names: optionNames(entry.services),
              amenity_names: optionNames(entry.amenities),
              // Find libraries' filters, counts and sorts; see the module.
              ...librarySearchFields(entry, lat, lng, { notices }),
              // _geo enables MeiliSearch geo radius filtering and distance sorting
              ...(lat != null && lng != null ? { _geo: { lat, lng } } : {}),
            }
          },
        },
      },
    },

    seo: {
      enabled: true,
    },

    "users-permissions": {
      config: {
        jwt: {
          expiresIn: "30d",
        },
      },
    },

    sentry: {
      enabled: true,
      config: {
        // Only set `dsn` property in production
        dsn: env("NODE_ENV") === "production" ? env("SENTRY_DSN") : null,
        sendMetadata: true,
        // Spread into Sentry.init by @strapi/plugin-sentry. A thrown error in a
        // bridge route otherwise ships X-Service-Secret, the Strapi JWT, cookies
        // and the JSON body to Sentry.
        init: {
          sendDefaultPii: false,
          beforeSend: scrubSentryEvent,
          beforeSendTransaction: scrubSentryEvent,
        },
      },
    },

    email: {
      config: prepareEmailConfig(env),
    },

    "content-moderation": {
      enabled: true,
      resolve: "./src/plugins/content-moderation",
    },

    "library-staff": { enabled: true, resolve: "./src/plugins/library-staff" },
    // People (Role Grants), Teams and Plans.
    access: { enabled: true, resolve: "./src/plugins/access" },
    "beta-invites": { enabled: true, resolve: "./src/plugins/beta-invites" },

    "mobile-libraries": {
      enabled: true,
      resolve: "./src/plugins/mobile-libraries",
    },

    rewards: {
      enabled: true,
      resolve: "./src/plugins/rewards",
    },

    events: {
      enabled: true,
      resolve: "./src/plugins/events",
    },
  }
}

// ── Meilisearch document shapes ───────────────────────────────────────────────
// `documentId` and `publishedAt` must be fetched: the plugin drops unpublished
// entries by reading `publishedAt` off the raw entry, then builds
// `_meilisearch_id` from the transformed document's `documentId` and `locale`
// (localized types only; the events type's `locale` is private and stripped
// by the plugin before the transform). Strapi always returns `id`.

type Rec = Record<string, unknown>

/**
 * Index every locale's version (the UI filters by `locale`). Strapi 5's
 * Document Service spells "every locale" `"*"`; the plugin passes this
 * straight through, and its Strapi 4 spelling `"all"` matches no rows.
 */
const ALL_LOCALES = "*"
const MEDIA_FIELDS = ["url", "alternativeText", "formats"]

const ARTICLE_FIELDS = [
  "documentId",
  "locale",
  "title",
  "slug",
  "summary",
  "author",
  "publishedAt",
  "updatedAt",
  "readingTimeMinutes",
  "geographyFacet",
]
const ARTICLE_POPULATE = {
  ...ARTICLE_BROWSE_POPULATE,
  section: { fields: ["slug", "name"] },
  category: { fields: ["slug", "name"] },
  heroImage: { fields: MEDIA_FIELDS },
}
const JOURNAL_ARTICLE_POPULATE = {
  ...JOURNAL_BROWSE_POPULATE,
  ...ARTICLE_POPULATE,
}
const ARTICLE_DOC_KEYS = [
  "id",
  ...ARTICLE_FIELDS.filter((field) => field !== "geographyFacet"),
]
const ARTICLE_FACET_FIELDS = [
  "continents_ids",
  "countries_ids",
  "regions_ids",
  "areas_ids",
  "libraries_ids",
  "topics_ids",
  "authors_ids",
  "events_ids",
  "origins_ids",
  "sections_ids",
]
const ARTICLE_FILTERABLE = [
  "section_slug",
  "locale",
  "publicationOrigin",
  "author_username",
  ...ARTICLE_FACET_FIELDS,
]
const ARTICLE_DISPLAYED = [
  ...ARTICLE_DOC_KEYS,
  "heroImage",
  "section_slug",
  "section_name",
  "category_slug",
  "category_name",
  "publicationOrigin",
  "author_username",
  "geographyFacet",
  ...ARTICLE_FACET_FIELDS,
]

const EVENT_FIELDS = [
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
  "publishedAt",
  "updatedAt",
]
const EVENT_DOC_KEYS = ["id", ...EVENT_FIELDS]
const EVENT_DISPLAYED = [
  ...EVENT_DOC_KEYS,
  "timeSlot",
  "startTimestamp",
  "library_name",
  "library_slug",
  "library_city",
  "library_country_code",
  "library_country_slug",
  "library_country_name",
  "library_continent_slug",
  "library_region_slug",
]

const LIBRARY_FIELDS = [
  "documentId",
  "locale",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "operatorType",
  "operationalStatus",
  "foundedYear",
  "city",
  "district",
  "featured",
  "timezone",
  "openingTimes",
  "mobileTimetable",
  "hasStaff",
  "operatorName",
  "timetableUrl",
  "iiifEndpoint",
  "completeness",
  "location",
  "gaps",
  "createdAt",
  "lastVerifiedAt",
  "verifiedSections",
  "publishedAt",
  "updatedAt",
]
// Fetched only to derive other fields; never stored as is. The timetable
// (up to 200 KB) feeds `stop_count` and `cycle_weeks` only (1.8).
const DERIVE_ONLY = new Set([
  "mobileTimetable",
  "location",
  "gaps",
  "verifiedSections",
  "lastVerifiedAt",
  "createdAt",
])
const LIBRARY_DOC_KEYS = [
  "id",
  "source",
  "libraryType",
  ...LIBRARY_FIELDS.filter((f) => !DERIVE_ONLY.has(f)),
]
/** Derived by librarySearchFields; completeness is a document key and is filterable too. */
const LIBRARY_SEARCH_FIELDS = [
  "has_hours",
  "has_staff",
  "has_effective_hours",
  "effective_week_start",
  "clock_valid_until",
  "late_sunday",
  "closed_dates",
  "notice_active",
  "stop_count",
  "cycle_weeks",
  "has_iiif",
  "needs",
  "open_tz",
  "geo_cell",
  ...OPEN_FIELD_NAMES,
  ...OPEN_FIELD_NAMES.map((field) => field.replace("open_", "regular_open_")),
  ...OPEN_FIELD_NAMES.map((field) => field.replace("open_", "staff_open_")),
  "clock_valid_until_ts",
  ...TIMESTAMP_FIELD_NAMES,
]
const LIBRARY_DISPLAYED = [
  ...LIBRARY_DOC_KEYS,
  "heroImage",
  "continent_slug",
  "continent_name",
  "country_slug",
  "country_name",
  "country_code",
  "country_region_label",
  "country_regions_label",
  "country_area_label",
  "country_areas_label",
  "region_slug",
  "region_name",
  "region_area_label",
  "region_areas_label",
  "area_slug",
  "area_name",
  "accessibility_names",
  "service_names",
  "amenity_names",
  "_geo",
  ...LIBRARY_SEARCH_FIELDS,
]

const asRecord = (value: unknown): Rec | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Rec)
    : null

/** Copy exactly `keys` from `entry`; absent values become `null`. */
const pick = (entry: Rec, keys: readonly string[]): Rec =>
  Object.fromEntries(keys.map((key) => [key, entry[key] ?? null]))

/** `url`, `alternativeText` and `formats` of a media entry — nothing else. */
const mediaSummary = (value: unknown): Rec | null => {
  const media = asRecord(value)

  return media ? pick(media, MEDIA_FIELDS) : null
}

/** Names of populated option relations (services, amenities, accessibility). */
const optionNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((option) => asRecord(option)?.name)
        .filter(
          (name): name is string => typeof name === "string" && name !== ""
        )
    : []

const countryCode = (iso2: unknown): string | null =>
  typeof iso2 === "string" && iso2 !== "" ? iso2.toUpperCase() : null

/** A trimmed string, or `null` for anything blank or not a string. */
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null

const coordinate = (value: unknown): number | null => {
  if (value == null || value === "") return null
  const n = Number(value)

  return Number.isFinite(n) ? n : null
}

const articleDocument = (entry: Rec, kind: "blog" | "wiki"): Rec => {
  const section = asRecord(entry.section)
  const category = asRecord(entry.category)

  return {
    ...pick(entry, ARTICLE_DOC_KEYS),
    heroImage: mediaSummary(entry.heroImage),
    section_slug: section?.slug ?? null,
    section_name: section?.name ?? null,
    category_slug: category?.slug ?? null,
    category_name: category?.name ?? null,
    ...articleSearchFacets(entry, kind),
  }
}

const localUploadConfig: Record<string, unknown> = {
  // Local provider setup
  // https://docs.strapi.io/dev-docs/plugins/upload
  sizeLimit: 250 * 1024 * 1024, // 256mb in bytes,
}

const prepareAwsS3Config = (env) => {
  const awsAccessKeyId = env("AWS_ACCESS_KEY_ID")
  const awsAccessSecret = env("AWS_ACCESS_SECRET")
  const awsRegion = env("AWS_REGION")
  const awsBucket = env("AWS_BUCKET")
  const awsRequirements = [
    awsAccessKeyId,
    awsAccessSecret,
    awsRegion,
    awsBucket,
  ]
  const awsRequirementsOk = awsRequirements.every(
    (req) => req != null && req !== ""
  )

  if (awsRequirementsOk) {
    return {
      provider: "aws-s3",
      providerOptions: {
        baseUrl: env("CDN_URL"),
        rootPath: env("CDN_ROOT_PATH"),
        s3Options: {
          endpoint: env("AWS_ENDPOINT"),
          forcePathStyle: env.bool("AWS_FORCE_PATH_STYLE", false),
          credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsAccessSecret,
          },
          region: awsRegion,
          params: {
            ACL: env("AWS_ACL", "public-read"),
            signedUrlExpires: env("AWS_SIGNED_URL_EXPIRES", 15 * 60),
            Bucket: awsBucket,
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    }
  }
}

const prepareEmailConfig = (env) => {
  if (env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS")) {
    return {
      provider: "nodemailer",
      providerOptions: {
        host: env("SMTP_HOST"),
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        port: Number.parseInt(env("SMTP_PORT", "587"), 10),
        secure: env("SMTP_SECURE", "false") === "true",
        requireTLS: env("SMTP_SECURE", "false") !== "true",
        auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
      },
      settings: {
        defaultFrom: env("EMAIL_FROM", "noreply@libraries.global"),
        defaultReplyTo: env("EMAIL_REPLY_TO", "info@libraries.global"),
      },
    }
  }
  const hasMailgunCreds = env("MAILGUN_API_KEY") && env("MAILGUN_DOMAIN")
  const hasMailtrapCreds = env("MAILTRAP_USER") && env("MAILTRAP_PASS")

  // Mailgun takes priority over the development Mailtrap sandbox.
  // Mailtrap is only for development/testing purposes

  if (hasMailgunCreds) {
    return {
      provider: "mailgun",
      providerOptions: {
        key: env("MAILGUN_API_KEY"),
        domain: env("MAILGUN_DOMAIN"),
        url: env("MAILGUN_HOST", "https://api.eu.mailgun.net"),
      },
      settings: {
        defaultFrom: env("MAILGUN_EMAIL") || "noreply@libraries.global",
        defaultReplyTo: env("MAILGUN_EMAIL") || "info@libraries.global",
      },
    }
  }

  if (hasMailtrapCreds) {
    return {
      provider: "nodemailer",
      providerOptions: {
        host: env("MAILTRAP_HOST", "sandbox.smtp.mailtrap.io"),
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        port: Number.parseInt(env("MAILTRAP_PORT", "2525"), 10),
        auth: {
          user: env("MAILTRAP_USER"),
          pass: env("MAILTRAP_PASS"),
        },
      },
      settings: {
        defaultFrom:
          env("EMAIL_FROM") ||
          env("MAILTRAP_EMAIL") ||
          "noreply@libraries.global",
        defaultReplyTo:
          env("EMAIL_REPLY_TO") ||
          env("MAILTRAP_EMAIL") ||
          "info@libraries.global",
      },
    }
  }

  console.warn(
    "⚠️  No email provider is configured. Email functionality will not work."
  )

  return null
}
