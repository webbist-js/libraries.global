/**
 * drive controller.
 *
 * Public reads need no auth. Board writes are `auth: false` at the route
 * level and gated here instead: the bridge secret plus `X-Ba-User-Id`
 * (`bridgeBaUserId`), then `isBoardMember` re-checking the caller's live
 * Role Grants — never trusting anything the client claims about itself.
 *
 * The public list takes `?state=` rather than `?status=`: the global
 * `strip-draft-status` middleware (`src/middlewares/strip-draft-status.ts`)
 * removes any `status` query key from every unauthenticated `/api/*`
 * request, so a param literally named `status` would always arrive empty
 * here. The schema attribute itself is still called `status`, and the
 * public JSON still says `status` — only the query string's name differs.
 */

import type { DriveInput } from "@repo/shared-data"
import { factories } from "@strapi/strapi"

import { isBoardMember } from "../../../utils/board"
import {
  bridgeBaUserId,
  isValidServiceSecret,
} from "../../../utils/service-secret"

const UID = "api::drive.drive"

/** Answers the ctx and returns null when the caller is not a board member. */
async function requireBoardMember(
  ctx: any,
  strapi: any
): Promise<string | null> {
  const headers = ctx.request?.headers ?? ctx.request?.header ?? {}
  if (!isValidServiceSecret(headers["x-service-secret"])) {
    ctx.unauthorized("Missing or invalid service secret")

    return null
  }
  const baUserId = bridgeBaUserId(ctx)
  if (!baUserId) {
    ctx.unauthorized("Missing user")

    return null
  }
  if (!(await isBoardMember(strapi, baUserId))) {
    ctx.forbidden("Only the editorial board manages drives.")

    return null
  }

  return baUserId
}

/**
 * The `DriveInput` shape out of a request body — only the keys the body
 * actually carries, so a partial update (text fields only) doesn't look like
 * it touched every field. `validateDrive` is the real gate, downstream; this
 * is an unchecked parse, same as the other bridge-gated controllers in this
 * codebase.
 */
function driveInputFromBody(body: unknown): Partial<DriveInput> & {
  pinned?: boolean
} {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const out: Record<string, unknown> = {}
  for (const key of [
    "title",
    "summary",
    "steps",
    "focus",
    "scope",
    "unit",
    "startsAt",
    "endsAt",
    "goalPercent",
    "whereToLook",
  ]) {
    if (b[key] !== undefined) out[key] = b[key]
  }
  if (typeof b.pinned === "boolean") out.pinned = b.pinned

  return out as Partial<DriveInput> & { pinned?: boolean }
}

/** 409 with `ctx.conflict` where the Koa app provides it, else a manual body. */
function conflict(ctx: any, message: string) {
  if (typeof ctx.conflict === "function") return ctx.conflict(message)
  ctx.status = 409
  ctx.body = { data: null, error: { status: 409, message } }
}

/**
 * A service-result's errors as a 400/404/409. The 400 path always passes
 * `details: { errors }` as `ctx.badRequest`'s second argument — passing the
 * errors array as the *message* (`ctx.badRequest({ errors })`) makes
 * `http-errors` treat it as extra properties instead, and the body comes
 * back with `message: "Bad Request"`, losing every validation message.
 */
function sendErrors(
  ctx: any,
  result: { errors: string[]; status?: number },
  badRequestMessage: string
) {
  if (result.status === 409) return conflict(ctx, result.errors[0]!)
  if (result.status === 404) return ctx.notFound(result.errors[0])

  return ctx.badRequest(badRequestMessage, { errors: result.errors })
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /drives?state=&limit=&locale= — public.
  async list(ctx) {
    const { state, limit, locale } = ctx.query as Record<string, unknown>
    const data = await strapi
      .service(UID)
      .listPublic(
        typeof state === "string" ? state : undefined,
        limit !== undefined ? Number(limit) : undefined,
        typeof locale === "string" ? locale : undefined
      )
    ctx.body = { data, meta: {} }
  },

  // GET /drives/by-slug/:slug — public.
  async bySlug(ctx) {
    const { slug } = ctx.params as { slug: string }
    const { locale } = ctx.query as Record<string, unknown>
    const data = await strapi
      .service(UID)
      .bySlug(slug, typeof locale === "string" ? locale : undefined)
    if (!data) return ctx.notFound("Drive not found.")
    ctx.body = { data, meta: {} }
  },

  // POST /drives — board only.
  async create(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const result = await strapi
      .service(UID)
      .createDrive(driveInputFromBody(ctx.request.body), baUserId)
    if ("errors" in result) return sendErrors(ctx, result, "Invalid drive")
    ctx.body = { data: result.data, meta: {} }
  },

  // PUT /drives/:documentId — board only.
  async update(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const { documentId } = ctx.params as { documentId: string }
    const { pinned: _pinned, ...input } = driveInputFromBody(ctx.request.body)
    const result = await strapi.service(UID).updateDrive(documentId, input)
    if ("errors" in result) return sendErrors(ctx, result, "Invalid drive")
    ctx.body = { data: result.data, meta: {} }
  },

  // GET /drives/:documentId/stats — public. 404 for an unknown or
  // unpublished (`draft`) Drive.
  async stats(ctx) {
    const { documentId } = ctx.params as { documentId: string }
    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const data = await strapi.service(UID).stats(documentId)
    ctx.body = { data, meta: {} }
  },

  // GET /drives/:documentId/leaderboard?period=week|all&limit= — public.
  // 404 for an unknown or unpublished (`draft`) Drive. Never carries a
  // `baUserId`.
  async leaderboard(ctx) {
    const { documentId } = ctx.params as { documentId: string }
    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const { period, limit } = ctx.query as Record<string, unknown>
    const data = await strapi
      .service(UID)
      .leaderboard(
        documentId,
        period === "week" ? "week" : "all",
        limit !== undefined ? Number(limit) : 20
      )
    ctx.body = { data, meta: {} }
  },

  // POST /drives/:documentId/actions — board only. Body: { action, ...payload }.
  async act(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const { documentId } = ctx.params as { documentId: string }
    const body = (ctx.request.body ?? {}) as { action?: unknown } & Record<
      string,
      unknown
    >
    const { action, ...payload } = body
    if (typeof action !== "string" || action.length === 0) {
      return ctx.badRequest("Body must include an action.")
    }

    const result = await strapi.service(UID).act(documentId, action, payload)
    if ("errors" in result) return sendErrors(ctx, result, "Invalid action")
    ctx.body = { data: result.data, meta: {} }
  },
}))
