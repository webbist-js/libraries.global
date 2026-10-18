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
import { configureDriveDiscussions } from "../../../utils/drive-discussions"
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
  storySlug?: string | null
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
  // Not part of `DriveInput`: the Journal story link, kept like `pinned`.
  if (typeof b.storySlug === "string" || b.storySlug === null) {
    out.storySlug = b.storySlug
  }

  return out as Partial<DriveInput> & {
    pinned?: boolean
    storySlug?: string | null
  }
}

/** 409 with `ctx.conflict` where the Koa app provides it, else a manual body. */
function conflict(ctx: any, message: string) {
  if (typeof ctx.conflict === "function") return ctx.conflict(message)
  ctx.status = 409
  ctx.body = { data: null, error: { status: 409, message } }
}

/** 422 with `ctx.unprocessableEntity` where provided, else a manual body. */
function unprocessable(ctx: any, message: string) {
  if (typeof ctx.unprocessableEntity === "function")
    return ctx.unprocessableEntity(message)
  ctx.status = 422
  ctx.body = { data: null, error: { status: 422, message } }
}

/**
 * Like `bridgeBaUserId`, but a missing `X-Ba-User-Id` is fine — it answers
 * "nobody" rather than refusing the request. Only an invalid or missing
 * service secret fails `secretOk`, so the caller can 401 on that alone.
 * Used by `GET /drives/:documentId/holds`, where the viewer may be signed
 * out (the secret is still required: it's a server-to-server read).
 */
function optionalBridgeBaUserId(ctx: any): {
  secretOk: boolean
  baUserId: string | null
} {
  const headers = ctx.request?.headers ?? ctx.request?.header ?? {}
  if (!isValidServiceSecret(headers["x-service-secret"]))
    return { secretOk: false, baUserId: null }
  const id = headers["x-ba-user-id"]

  return {
    secretOk: true,
    baUserId:
      typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null,
  }
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

/** Preserve validation/conflict responses after the atomic Drive/link write rolls back. */
async function discussionWrite<T>(
  ctx: any,
  write: () => Promise<T>
): Promise<T | null> {
  try {
    return await write()
  } catch (error: any) {
    const duplicate = [
      "23505",
      "SQLITE_CONSTRAINT_UNIQUE",
      "ER_DUP_ENTRY",
    ].includes(error?.code)
    const status = duplicate ? 409 : error?.status
    if (![400, 401, 403, 404, 409, 429, 503].includes(status)) throw error
    ctx.status = status
    ctx.body = {
      data: null,
      error: {
        status,
        message: duplicate
          ? "Drive conversations changed. Reload and try again."
          : error.message,
      },
    }

    return null
  }
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

    const result = await discussionWrite(ctx, () =>
      strapi.db.transaction(async () => {
        const created = await strapi
          .service(UID)
          .createDrive(driveInputFromBody(ctx.request.body), baUserId)
        if (!("errors" in created))
          await configureDriveDiscussions(
            strapi,
            baUserId,
            created.data.documentId,
            String(ctx.request.body.locale ?? created.data.locale ?? "en"),
            ctx.request.body.discussions
          )

        return created
      })
    )
    if (!result) return
    if ("errors" in result) return sendErrors(ctx, result, "Invalid drive")
    ctx.body = { data: result.data, meta: {} }
  },

  // PUT /drives/:documentId — board only.
  async update(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const { documentId } = ctx.params as { documentId: string }
    const { pinned: _pinned, ...input } = driveInputFromBody(ctx.request.body)
    const result = await discussionWrite(ctx, () =>
      strapi.db.transaction(async () => {
        const saved = await strapi.service(UID).updateDrive(documentId, input)
        if (!("errors" in saved))
          await configureDriveDiscussions(
            strapi,
            baUserId,
            documentId,
            String(ctx.request.body.locale ?? saved.data.locale ?? "en"),
            ctx.request.body.discussions
          )

        return saved
      })
    )
    if (!result) return
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

  // GET /drives/:documentId/in-review — public. 404 for an unknown or
  // unpublished (`draft`) Drive. `targetDocumentId`s of this Drive's
  // pending/needs_info Submissions, so the task panel can hide libraries
  // already being worked on.
  async inReview(ctx) {
    const { documentId } = ctx.params as { documentId: string }
    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const data = await strapi.service(UID).inReviewTargets(documentId)
    ctx.body = { data, meta: {} }
  },

  // GET /drives/:documentId/mine — the bridge secret plus X-Ba-User-Id
  // (401 otherwise): the caller's sent, in-review and accepted counts for
  // this Drive ("Your part"). 404 for an unknown or `draft` Drive.
  async mine(ctx) {
    const baUserId = bridgeBaUserId(ctx)
    if (!baUserId) return ctx.unauthorized("Service secret and user required.")

    const { documentId } = ctx.params as { documentId: string }
    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const data = await strapi.service(UID).mine(documentId, baUserId)
    ctx.set?.("Cache-Control", "no-store")
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

  // POST /drives/lifecycle/run — board only. For local testing and E2E: the
  // hourly cron (`config/cron-tasks.ts`) calls `runLifecycle` directly and
  // never reaches this route.
  async runLifecycle(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const data = await strapi.service(UID).runLifecycle(new Date())
    ctx.body = { data, meta: {} }
  },

  // POST /drives/:documentId/holds — signed-in only (bridge secret plus
  // X-Ba-User-Id). Body: { libraryDocumentId }. "Give me a library" and
  // picking a row by hand both place a hold here.
  async hold(ctx) {
    const baUserId = bridgeBaUserId(ctx)
    if (!baUserId) return ctx.unauthorized("Service secret and user required.")

    const { documentId } = ctx.params as { documentId: string }
    const body = (ctx.request.body ?? {}) as { libraryDocumentId?: unknown }
    const libraryDocumentId = body.libraryDocumentId
    if (typeof libraryDocumentId !== "string" || libraryDocumentId.length === 0)
      return ctx.badRequest("Invalid library")

    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const result = await strapi
      .service(UID)
      .holdLibrary(documentId, libraryDocumentId, baUserId)
    if (!result.ok) {
      return result.reason === "not_open"
        ? unprocessable(ctx, "This drive isn’t open.")
        : conflict(ctx, "Someone’s on this library.")
    }

    ctx.body = {
      data: { libraryDocumentId, expiresAt: result.expiresAt },
      meta: {},
    }
  },

  // DELETE /drives/:documentId/holds/:libraryDocumentId — signed-in only;
  // releases the caller's own hold only.
  async releaseHold(ctx) {
    const baUserId = bridgeBaUserId(ctx)
    if (!baUserId) return ctx.unauthorized("Service secret and user required.")

    const { documentId, libraryDocumentId } = ctx.params as {
      documentId: string
      libraryDocumentId: string
    }
    const released = await strapi
      .service(UID)
      .releaseHold(documentId, libraryDocumentId, baUserId)
    ctx.body = { data: { released }, meta: {} }
  },

  // GET /drives/:documentId/holds — the bridge secret is required;
  // X-Ba-User-Id is optional. 404 for an unknown or `draft` Drive. Never
  // carries a baUserId in its response (spec §11).
  async holds(ctx) {
    const { secretOk, baUserId } = optionalBridgeBaUserId(ctx)
    if (!secretOk) return ctx.unauthorized("Service secret required.")

    const { documentId } = ctx.params as { documentId: string }
    const drive = await strapi
      .documents(UID)
      .findOne({ documentId, fields: ["documentId", "status"] })
    if (!drive || drive.status === "draft")
      return ctx.notFound("Drive not found.")

    const data = await strapi.service(UID).activeHolds(documentId, baUserId)
    ctx.set?.("Cache-Control", "no-store")
    ctx.body = { data, meta: {} }
  },
}))
