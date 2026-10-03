import {
  type Capabilities,
  isSubmissionType,
  MODERATION_QUEUES,
  type ModerationQueue,
} from "@repo/access"

import { decideFromRequest } from "./option-suggestion"
import { LIST_STATUSES, type ListStatus } from "../services/moderation"
import {
  HIERARCHY_KEYS,
  HIERARCHY_UIDS,
  type ModeratorTarget,
} from "../services/submission"
import { knownLocale } from "../utils/locales"
import { listSuggestions } from "../utils/option-suggestions"
import {
  isDocumentId,
  type LocationEdit,
  locationNameProblem,
  locationTypeLabelProblem,
} from "../utils/params"
import { contributorReviewer } from "../utils/reviewer"
import { isValidServiceSecret } from "../utils/service-secret"

/**
 * Community moderation on the site (`/api/content-moderation/moderation/*`).
 * Every route is `auth: false` and needs the bridge secret plus
 * `X-Ba-User-Id` (401 otherwise). The caller's capabilities are re-loaded
 * from their Role Grants on every request (403 with no Moderation Scope),
 * and each submission is checked with `canModerate` before it is shown or
 * decided. The reviewer is always the caller; no id comes from the body.
 */

const PAGE = { def: 1, min: 1, max: 500 }
const PAGE_SIZE = { def: 25, min: 1, max: 50 }
const MAX_Q = 100
const MAX_NOTE = 2000
const DECISIONS = new Set(["approved", "rejected", "needs_info"])

type Viewer = { id: string; email: string | null; name: string | null }

function clampInt(
  value: unknown,
  { def, min, max }: { def: number; min: number; max: number }
): number {
  if (typeof value !== "string" && typeof value !== "number") return def
  if (typeof value === "string" && value.trim() === "") return def
  const n = Math.trunc(Number(value))
  if (Number.isNaN(n)) return def

  return Math.min(max, Math.max(min, n))
}

function fail(
  ctx: any,
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
): void {
  ctx.status = status
  ctx.body = { error: { status, message, ...extra } }
}

const header = (ctx: any, name: string): string | null => {
  const v = ctx.request?.headers?.[name]

  return typeof v === "string" && v.trim() ? v.trim() : null
}

/** The bridge-authenticated caller, or null. */
function viewerOf(ctx: any): Viewer | null {
  if (!isValidServiceSecret(ctx.request?.headers?.["x-service-secret"]))
    return null
  const id = header(ctx, "x-ba-user-id")
  if (!id) return null

  return {
    id,
    email: header(ctx, "x-ba-user-email"),
    name: header(ctx, "x-ba-user-name"),
  }
}

const NOT_FOUND = "Submission not found."

/** Optional enumerated query value: undefined, a member, or invalid. */
function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[]
): T | undefined | false {
  if (v === undefined || v === "") return undefined

  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : false
}

export default ({ strapi }: { strapi: any }) => {
  const moderation = () =>
    strapi.plugin("content-moderation").service("moderation")
  const submissions = () =>
    strapi.plugin("content-moderation").service("submission")

  /**
   * The caller and their capabilities, or null after a 401/403 response.
   * Capabilities come from the Role Grants, re-read per request.
   */
  async function authorise(ctx: any): Promise<{
    viewer: Viewer
    caps: Capabilities
    role: string | null
  } | null> {
    const viewer = viewerOf(ctx)
    if (!viewer) {
      fail(ctx, 401, "Service secret and user required.")

      return null
    }
    const { caps, role } = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .loadCapabilities(viewer.id)
    if (!caps?.moderation?.length) {
      fail(ctx, 403, "You don't moderate any queue.")

      return null
    }
    ctx.set?.("Cache-Control", "no-store")

    return { viewer, caps, role: role ?? null }
  }

  /**
   * Option suggestions are the editorial board's alone: an active
   * `editorial_board` Role Grant (the highest role), not merely a global
   * Moderator's `{ all, any locale }` scope.
   */
  const isBoard = (auth: { role: string | null }) =>
    auth.role === "editorial_board"

  /**
   * The submission a decision route acts on, or null after a response:
   * 404 when it is missing, a draft or out of scope (the GET routes' answer,
   * so scope can't be probed), 403 only when it is the caller's own.
   */
  async function decidable(
    ctx: any,
    auth: { viewer: Viewer; caps: Capabilities }
  ): Promise<any | null> {
    const { documentId } = (ctx.params ?? {}) as { documentId?: unknown }
    if (!isDocumentId(documentId)) {
      fail(ctx, 400, "Invalid documentId")

      return null
    }
    const row = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({
        documentId,
        fields: ["documentId", "status", "submittedByUserId"] as any,
      })
    if (
      row &&
      row.status !== "draft" &&
      row.submittedByUserId === auth.viewer.id
    ) {
      fail(ctx, 403, "You can't review your own submission.", {
        name: "self_review",
      })

      return null
    }
    const s = row
      ? await moderation().loadInScope(auth.caps, auth.viewer.id, documentId)
      : null
    if (!s) fail(ctx, 404, NOT_FOUND)

    return s
  }

  /** The in-scope submission named by the route, or null after a 400/404. */
  async function inScope(
    ctx: any,
    auth: { viewer: Viewer; caps: Capabilities }
  ): Promise<any | null> {
    const { documentId } = (ctx.params ?? {}) as { documentId?: unknown }
    if (!isDocumentId(documentId)) {
      fail(ctx, 400, "Invalid documentId")

      return null
    }
    const s = await moderation().loadInScope(
      auth.caps,
      auth.viewer.id,
      documentId
    )
    if (!s) fail(ctx, 404, NOT_FOUND)

    return s
  }

  return {
    // GET /moderation/submissions?status&queue&type&locale&q&page&pageSize
    async list(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      const q = (ctx.query ?? {}) as Record<string, unknown>

      const status = oneOf<ListStatus>(q.status, LIST_STATUSES)
      if (status === false)
        return fail(ctx, 400, "status must be pending, needs_info or decided")
      const queue = oneOf<ModerationQueue>(q.queue, MODERATION_QUEUES)
      if (queue === false) return fail(ctx, 400, "Unknown queue")
      if (q.type !== undefined && q.type !== "" && !isSubmissionType(q.type))
        return fail(ctx, 400, "Unknown submission type")
      let locale: string | undefined
      if (q.locale !== undefined && q.locale !== "") {
        const known = await knownLocale(strapi, q.locale)
        if (!known) return fail(ctx, 400, "Unknown locale")
        locale = known
      }
      let search: string | undefined
      if (q.q !== undefined) {
        if (typeof q.q !== "string") return fail(ctx, 400, "Invalid q")
        if (q.q.length > MAX_Q)
          return fail(ctx, 400, `q is limited to ${MAX_Q} characters`)
        search = q.q.trim() || undefined
      }

      ctx.body = await moderation().list(auth.caps, auth.viewer.id, {
        status: status ?? "pending",
        queue,
        type: isSubmissionType(q.type) ? q.type : undefined,
        locale,
        q: search,
        page: clampInt(q.page, PAGE),
        pageSize: clampInt(q.pageSize, PAGE_SIZE),
      })
    },

    // GET /moderation/submissions/:documentId
    async findOne(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      const s = await inScope(ctx, auth)
      if (!s) return
      ctx.body = { data: await moderation().detail(s) }
    },

    // GET /moderation/submissions/:documentId/events
    async events(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      const s = await inScope(ctx, auth)
      if (!s) return
      ctx.body = {
        data: await moderation().events(s.documentId, auth.viewer.id),
      }
    },

    // PUT /moderation/submissions/:documentId/status  { status, note?, publish? }
    async updateStatus(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      const { documentId } = (ctx.params ?? {}) as { documentId?: unknown }
      if (!isDocumentId(documentId)) return fail(ctx, 400, "Invalid documentId")
      const body = (ctx.request?.body ?? {}) as Record<string, unknown>
      const { status, note, publish } = body
      if (typeof status !== "string" || !DECISIONS.has(status))
        return fail(ctx, 400, "status must be approved, rejected or needs_info")
      if (note !== undefined && note !== null && typeof note !== "string")
        return fail(ctx, 400, "note must be text")
      const text = typeof note === "string" ? note.trim() : ""
      if (text.length > MAX_NOTE)
        return fail(ctx, 400, `The note is limited to ${MAX_NOTE} characters.`)
      if ((status === "rejected" || status === "needs_info") && !text)
        return fail(ctx, 400, "Say what needs to change: a note is required.")
      if (publish !== undefined && typeof publish !== "boolean")
        return fail(ctx, 400, "publish must be true or false")

      // Refused before the service is asked to do anything (`canModerate`).
      const s = await decidable(ctx, auth)
      if (!s) return
      const locale = await moderation().localeOf(s)
      const wantsPublish = publish === true && status === "approved"
      if (wantsPublish && !(await moderation().canPublish(s, locale)))
        return fail(ctx, 400, "This submission can't be published on approval.")

      const reviewer = contributorReviewer({
        id: auth.viewer.id,
        email: auth.viewer.email,
      })
      const result = await submissions().updateStatus(
        documentId,
        status,
        reviewer,
        text || undefined,
        { publish: wantsPublish }
      )

      if ("error" in result) {
        switch (result.error) {
          case "not_found":
            return fail(ctx, 404, "Submission not found.")
          case "self_review":
            return fail(ctx, 403, "You can't review your own submission.", {
              name: "self_review",
            })
          case "tampered":
            return fail(
              ctx,
              422,
              "This submission changed after it was submitted for review.",
              { name: "tampered" }
            )
          case "apply_refused":
            return fail(
              ctx,
              409,
              result.reason === "no_hierarchy"
                ? "This library needs a continent, country and region before it can be published. Set its location, then approve again."
                : "This record has no published version; an admin must publish it first.",
              { name: "apply_refused", reason: result.reason }
            )
          case "apply_failed":
            return fail(
              ctx,
              500,
              result.unreverted
                ? "Approval could not be applied, and the submission could not be returned to review. An admin needs to fix it."
                : "Approval could not be applied; the submission is back in review.",
              {
                name: result.unreverted
                  ? "apply_failed_unreverted"
                  : "apply_failed",
              }
            )

          default:
            // conflict, invalid_transition
            return fail(
              ctx,
              409,
              "This submission was already decided or changed meanwhile.",
              { name: result.error }
            )
        }
      }
      const fresh = await strapi
        .documents("plugin::content-moderation.submission")
        .findOne({ documentId })
      ctx.body = { data: await moderation().detail(fresh ?? s) }
    },

    // PUT /moderation/submissions/:documentId/target
    //   { continent?, country?, region?, area?, name?, typeLabel? }
    // Places set (or, all empty, clear) the hierarchy; `name` and
    // `typeLabel` are a Location Request's Moderator edit (null clears one).
    async setTarget(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      const s = await decidable(ctx, auth)
      if (!s) return
      const body = ctx.request?.body
      if (!body || typeof body !== "object" || Array.isArray(body))
        return fail(ctx, 400, "Expected an object of place ids")
      const target: ModeratorTarget = {}
      const edit: Partial<Record<keyof LocationEdit, string | null>> = {}
      let hasPlaces = false
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (k === "name" || k === "typeLabel") {
          if (v === null || v === undefined) {
            edit[k] = null
            continue
          }
          if (typeof v !== "string") return fail(ctx, 400, `${k} must be text`)
          const text = v.trim()
          const problem =
            k === "name"
              ? locationNameProblem(text)
              : locationTypeLabelProblem(text)
          if (problem) return fail(ctx, 400, problem)
          edit[k] = text
          continue
        }
        if (!(HIERARCHY_KEYS as readonly string[]).includes(k))
          return fail(ctx, 400, `Unknown place: ${k}`)
        hasPlaces = true
        if (v === null || v === undefined || v === "") continue
        if (!isDocumentId(v)) return fail(ctx, 400, `Invalid ${k} id`)
        const key = k as keyof ModeratorTarget
        const found = await strapi
          .documents(HIERARCHY_UIDS[key])
          .findOne({ documentId: v, fields: ["documentId"] as any })
        if (!found) return fail(ctx, 400, `No ${k} with that id`)
        target[key] = v
      }
      const hasEdit = Object.keys(edit).length > 0
      if (hasEdit && s.submissionType !== "location_request")
        return fail(
          ctx,
          400,
          "Only location requests take a name and a type."
        )
      if (hasEdit) {
        // The Moderator's words go live on approval: same check as a
        // contributor's.
        const safe = await strapi
          .plugin("content-moderation")
          .service("submission-policy")
          .checkContent({
            fields: Object.fromEntries(
              Object.entries(edit).filter(([, v]) => typeof v === "string")
            ),
          })
        if (!safe.ok) return fail(ctx, safe.status, safe.message)
      }

      // A bare edit leaves the place alone; `{}` still clears it.
      const result = await submissions().setModeratorTarget(
        s.documentId,
        hasPlaces || !hasEdit ? target : undefined,
        hasEdit ? edit : undefined
      )
      if ("error" in result) {
        if (result.error === "wrong_type")
          return fail(
            ctx,
            400,
            "Only new libraries and location requests take a location."
          )
        if (result.error === "not_found") return fail(ctx, 404, NOT_FOUND)
        if (result.error === "tampered")
          return fail(
            ctx,
            422,
            "This submission changed after it was submitted for review.",
            { name: "tampered" }
          )

        return fail(
          ctx,
          409,
          "This submission was already decided or changed meanwhile.",
          { name: result.error }
        )
      }
      ctx.body = { data: result.data }
    },

    // GET /moderation/stats
    async stats(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      ctx.body = { data: await moderation().stats(auth.caps, auth.viewer.id) }
    },

    // GET /moderation/relation-labels?type=  (the admin route, for Moderators)
    async relationLabels(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      // The admin route's handler: it reads only `ctx.query.type` and
      // published option names, nothing admin-only.
      await strapi
        .plugin("content-moderation")
        .controller("submission")
        .relationLabels(ctx)
    },

    // GET /moderation/option-suggestions  (editorial board)
    async optionSuggestions(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      if (!isBoard(auth))
        return fail(ctx, 403, "Only the editorial board decides suggestions.")
      ctx.body = { data: await listSuggestions(strapi) }
    },

    // PUT /moderation/option-suggestions/:id  (editorial board)
    async decideOptionSuggestion(ctx: any) {
      const auth = await authorise(ctx)
      if (!auth) return
      if (!isBoard(auth))
        return fail(ctx, 403, "Only the editorial board decides suggestions.")
      const result = await decideFromRequest(
        strapi,
        ctx.params?.id,
        ctx.request?.body,
        auth.viewer.name ?? "Editorial board"
      )
      if (!result.ok) return fail(ctx, result.status, result.message)
      ctx.body = { data: result.data }
    },
  }
}
