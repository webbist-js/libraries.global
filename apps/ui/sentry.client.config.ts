// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { getEnvVar } from "@/lib/env-vars"
import { isLivePagePath } from "@/lib/live-path"
import { scrubSentryEvent } from "@/lib/sentry-scrub"

// The live console carries location and confirmation codes: no replay there.
if (
  document.documentElement.dataset.mobileApp !== "true" &&
  !isLivePagePath(window.location.pathname) &&
  !/^\/(?:(?:en|cs|fr)\/)?beta\/?$/.test(window.location.pathname)
)
  Sentry.init({
    dsn: getEnvVar("NEXT_PUBLIC_SENTRY_DSN"),

    // Fault reporting is separate from optional analytics. No session replay.
    integrations: [],
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 0.3,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 0%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: 0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
