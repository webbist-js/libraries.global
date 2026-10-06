/**
 * drive controller.
 *
 * Public reads need no auth. Board writes are `auth: false` at the route
 * level and gated here instead: the bridge secret plus `X-Ba-User-Id`
 * (`bridgeBaUserId`), then `isBoardMember` re-checking the caller's live
 * Role Grants — never trusting anything the client claims about itself.
 */

import type { DriveInput } from "@repo/shared-data"
import { factories } from "@strapi/strapi"

import { isBoardMember } from "../../../utils/board"
import { bridgeBaUserId } from "../../../utils/service-secret"

// `as any`: the drive content type is not yet in the generated types
// (`types/generated/contentTypes.d.ts`). Regenerate and drop the cast once
// `generate:types` has run against a booted Strapi.
const UID = "api::drive.drive" as any

/** Answers the ctx and returns null when the caller is not a board member. */
async function requireBoardMember(
  ctx: any,
  strapi: any
): Promise<string | null> {
  const baUserId = bridgeBaUserId(ctx)
  if (!baUserId) {
    ctx.unauthorized("Missing or invalid service secret")

    return null
  }
  if (!(await isBoardMember(strapi, baUserId))) {
    ctx.forbidden("Only the editorial board manages drives.")

    return null
  }

  return baUserId
}

/**
 * The `DriveInput` shape out of a request body. Fields the body omits come
 * through as `undefined` despite the type saying otherwise — `validateDrive`
 * is the real gate, downstream; this is an unchecked parse, same as the
 * other bridge-gated controllers in this codebase.
 */
function driveInputFromBody(body: unknown): DriveInput & { pinned?: boolean } {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >

  return {
    title: b.title,
    summary: b.summary,
    steps: b.steps,
    focus: b.focus,
    scope: b.scope,
    unit: b.unit,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    goalPercent: b.goalPercent,
    whereToLook: b.whereToLook,
    pinned: typeof b.pinned === "boolean" ? b.pinned : undefined,
  } as DriveInput & { pinned?: boolean }
}

/** 409 with `ctx.conflict` where the Koa app provides it, else a manual body. */
function conflict(ctx: any, message: string) {
  if (typeof ctx.conflict === "function") return ctx.conflict(message)
  ctx.status = 409
  ctx.body = { error: { status: 409, message } }
}

function sendErrors(ctx: any, result: { errors: string[]; status?: number }) {
  if (result.status === 409) return conflict(ctx, result.errors[0]!)
  if (result.status === 404) return ctx.notFound(result.errors[0])

  return ctx.badRequest({ errors: result.errors })
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // GET /drives?status=&limit=&locale= — public.
  async list(ctx) {
    const { status, limit, locale } = ctx.query as Record<string, unknown>
    const data = await strapi
      .service(UID)
      .listPublic(
        typeof status === "string" ? status : undefined,
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
    ctx.body = { data, meta: {} }
  },

  // POST /drives — board only.
  async create(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const result = await strapi
      .service(UID)
      .createDrive(driveInputFromBody(ctx.request.body), baUserId)
    if ("errors" in result) return sendErrors(ctx, result)
    ctx.body = { data: result.data, meta: {} }
  },

  // PUT /drives/:documentId — board only.
  async update(ctx) {
    const baUserId = await requireBoardMember(ctx, strapi)
    if (!baUserId) return

    const { documentId } = ctx.params as { documentId: string }
    const { pinned: _pinned, ...input } = driveInputFromBody(ctx.request.body)
    const result = await strapi.service(UID).updateDrive(documentId, input)
    if ("errors" in result) return sendErrors(ctx, result)
    ctx.body = { data: result.data, meta: {} }
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
    if ("errors" in result) return sendErrors(ctx, result)
    ctx.body = { data: result.data, meta: {} }
  },
}))
