import { scrubSentryEvent } from "../src/utils/sentry-scrub"

export default ({ env }) => {
  const awsS3Config = prepareAwsS3Config(env)
  if (!awsS3Config) {
    console.warn(
      "AWS S3 upload configuration is not complete. Local file storage will be used."
    )
  }

  return {
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
            filterableAttributes: ["section_slug", "locale"],
            displayedAttributes: ARTICLE_DISPLAYED,
          },
          entriesQuery: {
            fields: ARTICLE_FIELDS,
            populate: ARTICLE_POPULATE,
            locale: ALL_LOCALES,
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return articleDocument(entry)
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
            filterableAttributes: ["section_slug", "category_slug", "locale"],
            displayedAttributes: ARTICLE_DISPLAYED,
          },
          entriesQuery: {
            fields: ARTICLE_FIELDS,
            populate: ARTICLE_POPULATE,
            locale: ALL_LOCALES,
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return articleDocument(entry)
          },
        },

        // Events — plugin content type; denormalise library location for geo/text search.
        // Keyed by the schema's `singularName`: strapi-plugin-meilisearch resolves
        // per-type config through `contentTypes[uid].modelName`, never the UID.
        event: {
          settings: {
            searchableAttributes: [
              "title",
              "summary",
              "library_name",
              "library_city",
              "library_country_name",
            ],
            filterableAttributes: [
              "eventType",
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
            fields: EVENT_FIELDS,
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
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const library = asRecord(entry.library)
            const country = asRecord(library?.country)
            const continent = asRecord(library?.continent)
            const region = asRecord(library?.region)

            return {
              ...pick(entry, EVENT_DOC_KEYS),
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
            searchableAttributes: [
              "name",
              "shortName",
              "summary",
              "city",
              "district",
              "country_name",
              "region_name",
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
            ],
            sortableAttributes: ["name", "featured", "_geo"],
            displayedAttributes: LIBRARY_DISPLAYED,
          },
          entriesQuery: {
            fields: LIBRARY_FIELDS,
            locale: ALL_LOCALES,
            populate: {
              continent: { fields: ["slug", "name"] },
              country: { fields: ["iso2", "slug", "name"] },
              region: { fields: ["slug", "name"] },
              area: { fields: ["slug", "name"] },
              accessibility: { fields: ["name"] },
              services: { fields: ["name"] },
              amenities: { fields: ["name"] },
              heroImage: { fields: MEDIA_FIELDS },
            },
          },
          // Flatten nested relations so they are searchable/filterable,
          // and map the location custom field to MeiliSearch's _geo format.
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const continent = asRecord(entry.continent)
            const country = asRecord(entry.country)
            const region = asRecord(entry.region)
            const area = asRecord(entry.area)
            const location = asRecord(entry.location)
            const lat = coordinate(location?.lat)
            const lng = coordinate(location?.lng)

            return {
              ...pick(entry, LIBRARY_DOC_KEYS),
              heroImage: mediaSummary(entry.heroImage),
              continent_slug: continent?.slug ?? null,
              continent_name: continent?.name ?? null,
              country_slug: country?.slug ?? null,
              country_name: country?.name ?? null,
              country_code: countryCode(country?.iso2),
              region_slug: region?.slug ?? null,
              region_name: region?.name ?? null,
              area_slug: area?.slug ?? null,
              area_name: area?.name ?? null,
              // Flat arrays for checkbox filters in the UI
              accessibility_names: optionNames(entry.accessibility),
              service_names: optionNames(entry.services),
              amenity_names: optionNames(entry.amenities),
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
]
const ARTICLE_POPULATE = {
  section: { fields: ["slug", "name"] },
  category: { fields: ["slug", "name"] },
  heroImage: { fields: MEDIA_FIELDS },
}
const ARTICLE_DOC_KEYS = ["id", ...ARTICLE_FIELDS]
const ARTICLE_DISPLAYED = [
  ...ARTICLE_DOC_KEYS,
  "heroImage",
  "section_slug",
  "section_name",
  "category_slug",
  "category_name",
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
  "libraryType",
  "operatorType",
  "operationalStatus",
  "foundedYear",
  "city",
  "district",
  "featured",
  "timezone",
  "openingTimes",
  "iiifEndpoint",
  "location",
  "publishedAt",
  "updatedAt",
]
// `location` is only fetched to derive `_geo`; it never reaches the index.
const LIBRARY_DOC_KEYS = [
  "id",
  ...LIBRARY_FIELDS.filter((f) => f !== "location"),
]
const LIBRARY_DISPLAYED = [
  ...LIBRARY_DOC_KEYS,
  "heroImage",
  "continent_slug",
  "continent_name",
  "country_slug",
  "country_name",
  "country_code",
  "region_slug",
  "region_name",
  "area_slug",
  "area_name",
  "accessibility_names",
  "service_names",
  "amenity_names",
  "_geo",
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

const coordinate = (value: unknown): number | null => {
  if (value == null || value === "") return null
  const n = Number(value)

  return Number.isFinite(n) ? n : null
}

const articleDocument = (entry: Rec): Rec => {
  const section = asRecord(entry.section)
  const category = asRecord(entry.category)

  return {
    ...pick(entry, ARTICLE_DOC_KEYS),
    heroImage: mediaSummary(entry.heroImage),
    section_slug: section?.slug ?? null,
    section_name: section?.name ?? null,
    category_slug: category?.slug ?? null,
    category_name: category?.name ?? null,
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
  const hasMailgunCreds = env("MAILGUN_API_KEY") && env("MAILGUN_DOMAIN")
  const hasMailtrapCreds = env("MAILTRAP_USER") && env("MAILTRAP_PASS")

  // Mailgun has bigger priority
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
        port: Number.parseInt(env("MAILTRAP_PORT", "2525"), 10),
        auth: {
          user: env("MAILTRAP_USER"),
          pass: env("MAILTRAP_PASS"),
        },
      },
      settings: {
        defaultFrom: env("MAILTRAP_EMAIL") || "noreply@libraries.global",
        defaultReplyTo: env("MAILTRAP_EMAIL") || "info@libraries.global",
      },
    }
  }

  console.warn(
    "⚠️  No email provider is configured. Email functionality will not work."
  )

  return null
}
