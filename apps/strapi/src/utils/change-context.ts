import { AsyncLocalStorage } from "node:async_hooks"

import { isValidServiceSecret } from "./service-secret"

/**
 * Who made a write, for Change Records and Article Changes. The moderation
 * service sets it explicitly around every apply (`runWithChangeContext`);
 * otherwise it is read from the Koa request (admin panel, API token, bridge)
 * and falls back to `system` (cron jobs, bootstrap, scripts without a token).
 */

export type ChangeSource =
  | "submission"
  | "admin"
  | "api_token"
  | "import"
  | "system"

export type ActorKind = "contributor" | "admin" | "token" | "system"

export interface ChangeContext {
  source: ChangeSource
  actorKind: ActorKind
  actorId: string
  actorName?: string | null
  reviewerId?: string | null
  submissionDocumentId?: string | null
  editSummary?: string | null
}

const storage = new AsyncLocalStorage<ChangeContext>()

export function runWithChangeContext<T>(
  ctx: ChangeContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn)
}

const SYSTEM: ChangeContext = {
  source: "system",
  actorKind: "system",
  actorId: "system",
}

/**
 * Content API token strategy names: "content-api-token" in Strapi 5.55.1
 * (@strapi/admin server/src/strategies/content-api-token), "api-token" in
 * earlier 5.x releases.
 */
const TOKEN_STRATEGIES: ReadonlySet<unknown> = new Set([
  "content-api-token",
  "api-token",
])

const IMPORT_TOKEN = /^(import|ingest)/i

const header = (req: any, name: string): string | undefined => {
  const headers = req?.request?.headers ?? req?.headers ?? {}
  const v = headers[name]

  return typeof v === "string" && v.length > 0 ? v : undefined
}

function fromRequest(req: any): ChangeContext | null {
  const state = req?.state ?? {}
  const strategy = state.auth?.strategy?.name

  // Admin panel: the admin user. A users-permissions user is not an admin.
  const user = state.user
  if (
    user &&
    user.id !== undefined &&
    strategy !== "api-token" &&
    strategy !== "users-permissions"
  ) {
    const name = [user.firstname, user.lastname]
      .filter((p) => typeof p === "string" && p.length > 0)
      .join(" ")

    return {
      source: "admin",
      actorKind: "admin",
      actorId: `admin:${user.id}`,
      actorName: name || null,
    }
  }

  // Only an API token's credentials carry a trustworthy `name`.
  const tokenName = TOKEN_STRATEGIES.has(strategy)
    ? state.auth?.credentials?.name
    : undefined
  if (typeof tokenName === "string" && tokenName.length > 0) {
    return {
      source: IMPORT_TOKEN.test(tokenName) ? "import" : "api_token",
      actorKind: "token",
      actorId: tokenName,
    }
  }

  const baUserId = header(req, "x-ba-user-id")
  if (baUserId && isValidServiceSecret(header(req, "x-service-secret"))) {
    return {
      source: "submission",
      actorKind: "contributor",
      actorId: `ba:${baUserId}`,
      actorName: header(req, "x-ba-user-name") ?? null,
    }
  }

  return null
}

export function resolveChangeContext(strapi: any): ChangeContext {
  const explicit = storage.getStore()
  if (explicit) return explicit

  let req: unknown
  try {
    req = strapi?.requestContext?.get?.()
  } catch {
    req = undefined
  }

  return (req && fromRequest(req)) || { ...SYSTEM }
}
