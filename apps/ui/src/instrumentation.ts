import * as Sentry from "@sentry/nextjs"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
    // Builds and unit imports must not mutate the authentication database.
    // Next awaits register() before serving requests, so schema failure prevents
    // a partially ready server from accepting sign-ins.
    if (
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD &&
      process.env.NODE_ENV !== "test"
    ) {
      const { auth, authDbPool } = await import("./lib/auth")
      const { migrateAuthSchema } = await import("./lib/auth-migrations")
      await migrateAuthSchema(authDbPool, () => auth.$context)
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
