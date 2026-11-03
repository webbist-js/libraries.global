import * as Sentry from "@sentry/nextjs"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
    // Builds and unit imports must not mutate the application database.
    // Next awaits register() before serving requests, so schema failure prevents
    // a partially ready server from accepting requests.
    if (
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD &&
      process.env.NODE_ENV !== "test"
    ) {
      const { appDbPool } = await import("./lib/app-db")
      const { migrateApplicationState } = await import("./lib/app-migrations")
      await migrateApplicationState(appDbPool)
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
