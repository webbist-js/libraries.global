import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  emptyStringAsUndefined: true,

  /*
   * Server-side environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   *
   * These are marked as optional to allow Docker builds to succeed without
   * baking variables into the image. Runtime validation in the code is necessary
   * to ensure required variables are present. Making them mandatory here would
   * require them to be present at build time, which is not always desired or possible (see README).
   */
  server: {
    PRO_ENABLED: optionalZodBoolean(),
    BILLING_ENV: z.enum(["sandbox", "live"]).optional(),
    STRIPE_MANAGED_PAYMENTS_ENABLED: optionalZodBoolean(),
    STRIPE_SUPPORTER_APPROVED: optionalZodBoolean(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
    STRIPE_PRICE_SUPPORTER_MONTHLY: z.string().optional(),
    STRIPE_PRICE_SUPPORTER_ANNUAL: z.string().optional(),
    STRIPE_PORTAL_CONFIGURATION: z.string().optional(),
    APP_PUBLIC_URL: z.string().url().optional(),
    DEBUG_STATIC_PARAMS_GENERATION: optionalZodBoolean(),
    SHOW_NON_BLOCKING_ERRORS: optionalZodBoolean(),
    DEBUG_STRAPI_CLIENT_API_CALLS: optionalZodBoolean(),
    STRAPI_URL: z.string().url().optional(),
    STRAPI_REST_READONLY_API_KEY: z.string().optional(),
    STRAPI_REST_CUSTOM_API_KEY: z.string().optional(),
    STRAPI_PREVIEW_SECRET: z.string().optional(),
    // Comma-separated CDN hosts allowed in next/image, besides the Strapi hosts.
    IMAGE_REMOTE_HOSTS: z.string().optional(),

    NEXT_OUTPUT: z.string().optional(),

    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING: z.string().optional(),

    RECAPTCHA_SECRET_KEY: z.string().optional(),

    BASIC_AUTH_ENABLED: optionalZodBoolean(),
    BASIC_AUTH_USERNAME: z.string().optional(),
    BASIC_AUTH_PASSWORD: z.string().optional(),
    BETA_GATE_ENABLED: optionalZodBoolean(),
    BETA_PASSWORD: z.string().optional(),
    BETA_ACCESS_SECRET: z.string().optional(),
    BETA_ACCESS_VERSION: z.string().optional(),
    BETA_CONTACT_EMAIL: z.string().email().optional(),
    BETA_SOURCE_URL: z.string().url().optional(),
    MEILISEARCH_HOST: z.string().url().optional(),
    MEILISEARCH_SEARCH_API_KEY: z.string().optional(),
  },

  /*
   * Environment variables available on the client (and server).
   * You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   *
   * Note: These are baked into the client bundle at build time.
   * If you need different values per environment with a single Docker image,
   * consider runtime injection instead (through `window.__ENV__` or similar hack).
   */
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_PREVENT_UNUSED_FUNCTIONS_ERROR_LOGS: optionalZodBoolean(),
    NEXT_PUBLIC_STRAPI_URL: z.string().url().optional(),
  },

  shared: {
    // NODE_ENV makes app behave as if in production mode (optimized builds, no dev-only behavior, etc.)
    NODE_ENV: z.enum(["development", "production"]).optional(),
    // APP_ENV is used to determine the environment the app is running in. Used to divide deployments.
    APP_ENV: z.enum(["testing", "production"]).optional(),
  },

  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   * You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    PRO_ENABLED: process.env.PRO_ENABLED,
    BILLING_ENV: process.env.BILLING_ENV,
    STRIPE_MANAGED_PAYMENTS_ENABLED:
      process.env.STRIPE_MANAGED_PAYMENTS_ENABLED,
    STRIPE_SUPPORTER_APPROVED: process.env.STRIPE_SUPPORTER_APPROVED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
    STRIPE_PRICE_SUPPORTER_MONTHLY: process.env.STRIPE_PRICE_SUPPORTER_MONTHLY,
    STRIPE_PRICE_SUPPORTER_ANNUAL: process.env.STRIPE_PRICE_SUPPORTER_ANNUAL,
    STRIPE_PORTAL_CONFIGURATION: process.env.STRIPE_PORTAL_CONFIGURATION,
    // server
    APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
    DEBUG_STATIC_PARAMS_GENERATION: process.env.DEBUG_STATIC_PARAMS_GENERATION,
    DEBUG_STRAPI_CLIENT_API_CALLS: process.env.DEBUG_STRAPI_CLIENT_API_CALLS,
    SHOW_NON_BLOCKING_ERRORS: process.env.SHOW_NON_BLOCKING_ERRORS,
    STRAPI_URL: process.env.STRAPI_URL,
    STRAPI_REST_READONLY_API_KEY: process.env.STRAPI_REST_READONLY_API_KEY,
    STRAPI_REST_CUSTOM_API_KEY: process.env.STRAPI_REST_CUSTOM_API_KEY,
    STRAPI_PREVIEW_SECRET: process.env.STRAPI_PREVIEW_SECRET,
    IMAGE_REMOTE_HOSTS: process.env.IMAGE_REMOTE_HOSTS,

    NEXT_OUTPUT: process.env.NEXT_OUTPUT,

    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING:
      process.env.SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING,

    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,

    BASIC_AUTH_ENABLED: process.env.BASIC_AUTH_ENABLED,
    BASIC_AUTH_USERNAME: process.env.BASIC_AUTH_USERNAME,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
    BETA_GATE_ENABLED: process.env.BETA_GATE_ENABLED,
    BETA_PASSWORD: process.env.BETA_PASSWORD,
    BETA_ACCESS_SECRET: process.env.BETA_ACCESS_SECRET,
    BETA_ACCESS_VERSION: process.env.BETA_ACCESS_VERSION,
    BETA_CONTACT_EMAIL: process.env.BETA_CONTACT_EMAIL,
    BETA_SOURCE_URL: process.env.BETA_SOURCE_URL,
    MEILISEARCH_HOST: process.env.MEILISEARCH_HOST,
    MEILISEARCH_SEARCH_API_KEY: process.env.MEILISEARCH_SEARCH_API_KEY,

    // client
    // @dominik-juriga - find out if these are specific per environment
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
    NEXT_PUBLIC_PREVENT_UNUSED_FUNCTIONS_ERROR_LOGS:
      process.env.NEXT_PUBLIC_PREVENT_UNUSED_FUNCTIONS_ERROR_LOGS,
    NEXT_PUBLIC_STRAPI_URL: process.env.NEXT_PUBLIC_STRAPI_URL,

    // shared
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
  },
})

// Helpers

function optionalZodBoolean() {
  return z
    .string()
    .toLowerCase()
    .transform((x) => x === "true")
    .pipe(z.boolean())
    .optional()
}
