export default ({ env }) => {
  const awsS3Config = prepareAwsS3Config(env)
  if (!awsS3Config) {
    console.warn(
      "AWS S3 upload configuration is not complete. Local file storage will be used."
    )
  }

  return {
    upload: {
      config: awsS3Config ?? localUploadConfig,
    },

    "config-sync": {
      enabled: true,
    },

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
            filterableAttributes: ["section_slug"],
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const section = entry.section as Record<string, unknown> | null

            return {
              ...entry,
              section_slug: section?.slug ?? null,
              section_name: section?.name ?? null,
            }
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
            filterableAttributes: ["section_slug", "category_slug"],
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const section = entry.section as Record<string, unknown> | null
            const category = entry.category as Record<string, unknown> | null

            return {
              ...entry,
              section_slug: section?.slug ?? null,
              section_name: section?.name ?? null,
              category_slug: category?.slug ?? null,
              category_name: category?.name ?? null,
            }
          },
        },

        // Events — plugin content type; denormalise library location for geo/text search
        "plugin::events.event": {
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
          },
          entriesQuery: {
            populate: {
              library: {
                populate: {
                  country: { fields: ["iso2", "slug", "name"] },
                  continent: { fields: ["slug", "name"] },
                  region: { fields: ["slug", "name"] },
                },
              },
            },
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const library = entry.library as Record<string, unknown> | null
            const country = library?.country as Record<string, unknown> | null
            const continent = library?.continent as Record<
              string,
              unknown
            > | null
            const region = library?.region as Record<string, unknown> | null

            return {
              ...entry,
              library_name: library?.name ?? null,
              library_slug: library?.slug ?? null,
              library_city: library?.city ?? null,
              library_country_code:
                (country?.iso2 as string | null)?.toUpperCase() ?? null,
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
              "featured",
              "accessibility_names",
              "service_names",
              "operatorType",
              "_geo",
            ],
            sortableAttributes: ["name", "featured", "_geo"],
          },
          // Flatten nested relations so they are searchable/filterable,
          // and map the location custom field to MeiliSearch's _geo format.
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const continent = entry.continent as Record<string, unknown> | null
            const country = entry.country as Record<string, unknown> | null
            const region = entry.region as Record<string, unknown> | null
            const location = entry.location as {
              lat?: unknown
              lng?: unknown
            } | null
            const accessibility = entry.accessibility as
              | {
                  name?: string
                }[]
              | null
            const services = entry.services as
              | {
                  name?: string
                }[]
              | null
            const lat = location?.lat != null ? Number(location.lat) : null
            const lng = location?.lng != null ? Number(location.lng) : null

            return {
              ...entry,
              continent_slug: continent?.slug ?? null,
              continent_name: continent?.name ?? null,
              country_slug: country?.slug ?? null,
              country_name: country?.name ?? null,
              region_slug: region?.slug ?? null,
              region_name: region?.name ?? null,
              // Flat arrays for checkbox filters in the UI
              accessibility_names: Array.isArray(accessibility)
                ? accessibility.map((a) => a.name).filter(Boolean)
                : [],
              service_names: Array.isArray(services)
                ? services.map((s) => s.name).filter(Boolean)
                : [],
              // _geo enables MeiliSearch geo radius filtering and distance sorting
              ...(lat != null &&
              lng != null &&
              !Number.isNaN(lat) &&
              !Number.isNaN(lng)
                ? { _geo: { lat, lng } }
                : {}),
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
      },
    },

    email: {
      config: prepareEmailConfig(env),
    },

    "content-moderation": {
      enabled: true,
      resolve: "./src/plugins/content-moderation",
    },

    topics: {
      enabled: false,
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
        defaultFrom: env("MAILGUN_EMAIL") || "noreply@example.com",
        defaultReplyTo: env("MAILGUN_EMAIL") || "noreply@example.com",
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
        defaultFrom: env("MAILTRAP_EMAIL") || "noreply@example.com",
        defaultReplyTo: env("MAILTRAP_EMAIL") || "noreply@example.com",
      },
    }
  }

  console.warn(
    "⚠️  No email provider is configured. Email functionality will not work."
  )

  return null
}
