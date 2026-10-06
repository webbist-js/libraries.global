// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { getEnvVar } from "@/lib/env-vars"

Sentry.init({
  dsn: getEnvVar("NEXT_PUBLIC_SENTRY_DSN"),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.3,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Never send request bodies, cookies or headers: bodies can hold event
  // feed credentials and personal details. Mirrors Strapi's sentry-scrub.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      const ua = event.request.headers?.["user-agent"]
      event.request.headers = ua ? { "user-agent": ua } : {}
    }

    return event
  },
})
