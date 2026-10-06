// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { getEnvVar } from "@/lib/env-vars"
import { scrubSentryEvent } from "@/lib/sentry-scrub"

Sentry.init({
  dsn: getEnvVar("NEXT_PUBLIC_SENTRY_DSN"),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.3,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // No httpIntegration({ maxIncomingRequestBodySize }) here: the edge
  // runtime resolves @sentry/nextjs to @sentry/vercel-edge, which doesn't
  // instrument Node's http module and has no such option.
  //
  // Never send request bodies, cookies or most headers: bodies can hold
  // event feed credentials and personal details. Mirrors Strapi's
  // sentry-scrub. Transactions go through beforeSendTransaction, not
  // beforeSend, so both are scrubbed the same way.
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
})
