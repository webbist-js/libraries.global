// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

  integrations: [
    // Don't attach incoming request bodies to spans/breadcrumbs at all —
    // belt and braces alongside beforeSend/beforeSendTransaction below.
    Sentry.httpIntegration({ maxIncomingRequestBodySize: "none" }),
  ],

  // Never send request bodies, cookies or most headers: bodies can hold
  // event feed credentials and personal details. Mirrors Strapi's
  // sentry-scrub. Transactions go through beforeSendTransaction, not
  // beforeSend, so both are scrubbed the same way.
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
})
