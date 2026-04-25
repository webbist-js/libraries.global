import { magicLink } from "better-auth/plugins"

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
            ],
            sortableAttributes: ["name"],
          },
          // Flatten nested relations so they are searchable/filterable
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const continent = entry.continent as Record<string, unknown> | null
            const country = entry.country as Record<string, unknown> | null
            const region = entry.region as Record<string, unknown> | null

            return {
              ...entry,
              continent_slug: continent?.slug ?? null,
              continent_name: continent?.name ?? null,
              country_slug: country?.slug ?? null,
              country_name: country?.name ?? null,
              region_slug: region?.slug ?? null,
              region_name: region?.name ?? null,
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

    // The plugin internally reads config from "plugin::strapi-better-auth.*"
    // so the key here must be "strapi-better-auth", with resolve pointing at the package.
    "strapi-better-auth": {
      enabled: true,
      resolve: "./node_modules/@strapi-community/plugin-better-auth",
      config: {
        betterAuthOptions: {
          secret: env("BETTER_AUTH_SECRET"),
          baseURL: env("BETTER_AUTH_BASE_URL"),
          trustedOrigins: [env("APP_PUBLIC_URL")].filter(Boolean) as string[],
          emailAndPassword: {
            enabled: true,
            sendResetPassword: async ({ user, token }) => {
              const nextjsUrl = env("APP_PUBLIC_URL")
              const resetUrl = `${nextjsUrl}/auth/reset-password?token=${encodeURIComponent(token)}`
              await global.strapi.plugin("email").provider.send({
                to: user.email,
                subject: "Reset your libraries.global password",
                html: `<p>Reset your libraries.global password: <a href="${resetUrl}">${resetUrl}</a></p>`,
                text: `Reset your libraries.global password: ${resetUrl}`,
              })
            },
          },
          socialProviders: {
            github: {
              clientId: env("GITHUB_CLIENT_ID"),
              clientSecret: env("GITHUB_CLIENT_SECRET"),
            },
            google: {
              clientId: env("GOOGLE_CLIENT_ID"),
              clientSecret: env("GOOGLE_CLIENT_SECRET"),
            },
          },
          plugins: [
            magicLink({
              sendMagicLink: async ({ email, url }) => {
                await global.strapi.plugin("email").provider.send({
                  to: email,
                  subject: "Your sign-in link — libraries.global",
                  html: `<p>Sign in to libraries.global: <a href="${url}">${url}</a></p>`,
                  text: `Sign in to libraries.global: ${url}`,
                })
              },
            }),
          ],
          session: {
            expiresIn: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
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
