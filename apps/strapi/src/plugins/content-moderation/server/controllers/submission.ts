import { can } from "@repo/access"

import { ownsJournalArticle } from "../../../../utils/article-relations"
import { resolveUserEntitlements } from "../../../../utils/entitlement-inputs"
import { ensureFreshAdminApproval } from "../../../../utils/fresh-admin-auth"
import { decodeHeaderName } from "../../../../utils/header-name"
import { AccessError } from "../../../access/server/utils/admin"
import {
  resolveSubmissionLocale,
  splitSubmissionBody,
} from "../services/submission"
import { acceptedCount as countAccepted } from "../services/submission-policy"
import { defaultLocale } from "../utils/locales"
import {
  isDirectJournalEdit,
  isDirectWikiEdit,
  isDocumentId,
  isValidDraftData,
} from "../utils/params"
import { adminReviewer } from "../utils/reviewer"
import { isValidServiceSecret } from "../utils/service-secret"
import { resolveStaffLibraryCreation } from "../utils/staff-library-creation"
import {
  completeUpload,
  UploadReservationError,
} from "../utils/upload-reservations"

/** Parses a query value as an integer within [min, max]; anything else → def. */
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

const PAGE = { def: 1, min: 1, max: 10_000 }
const PAGE_SIZE = { def: 20, min: 1, max: 50 }
const MONTHS = { def: 24, min: 1, max: 60 }
const ARTICLE_KINDS = new Set(["wiki", "blog"])
const HISTORY_CACHE = "public, max-age=60"

// One place to map a policy verdict to the response, used by both `create`
// and `finalize`. A verdict with `details` (a drive proposal's validation
// errors) carries them as `error.details`.
function sendVerdict(
  ctx: any,
  verdict: { status: number; message: string; details?: unknown }
): void {
  ctx.status = verdict.status
  // A6: rate-limited callers are told when to come back (quotas are hourly).
  if (verdict.status === 429) ctx.set("Retry-After", "3600")
  ctx.body = {
    error: {
      status: verdict.status,
      message: verdict.message,
      ...(verdict.details ? { details: verdict.details } : {}),
    },
  }
}

type StatsData = {
  submissionsToday: number
  indexedLibraries: number
  totalContributors: number
  totalCountries: number
  totalLanguages: number
}

const STATS_TTL_MS = 60_000
let statsCache: { at: number; data: StatsData } | null = null

/** Drops the memoised stats (tests). */
export function resetStatsCache(): void {
  statsCache = null
}

export default ({ strapi }: { strapi: any }) => ({
  async journalOwnership(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const slug = ctx.params?.slug
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(slug))
      return ctx.badRequest("Invalid slug")
    ctx.set?.("Cache-Control", "no-store")
    ctx.body = {
      data: {
        isOwner: await ownsJournalArticle(strapi, user.id, {
          targetSlug: slug,
        }),
      },
    }
  },
  // GET /content-moderation/submissions?status=pending  (admin route)
  async findAll(ctx: any) {
    // auth handled by admin::isAuthenticatedAdmin policy on the route
    const { status } = ctx.query as { status?: string }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findPage(status, ctx.query)
    ctx.body = submissions
  },

  // GET /api/content-moderation/locales  (content-api route, public)
  // The languages an article can be written or translated in: Strapi's
  // configured locales, so the editor's language picker never drifts.
  async locales(ctx: any) {
    const locales: { code: string; name: string; isDefault?: boolean }[] =
      await strapi.plugin("i18n").service("locales").find()
    const defaultCode = await defaultLocale(strapi)
    ctx.body = {
      data: locales.map((l) => ({
        code: l.code,
        name: l.name,
        isDefault: l.code === defaultCode,
      })),
    }
  },

  // GET /api/content-moderation/submissions/stats  (content-api route, public)
  // Returns aggregate counts for the homepage contribute CTA and hero stats
  // bar. Public and unauthenticated, so the counts are memoised for a minute
  // (see `STATS_TTL_MS`) and the response is cacheable for as long.
  async stats(ctx: any) {
    const now = Date.now()
    if (!statsCache || now - statsCache.at > STATS_TTL_MS) {
      // "Today" is a UTC day, the same for every caller and every server.
      const todayStart = `${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`

      const [
        submissionsToday,
        indexedLibraries,
        totalContributors,
        totalCountries,
        languageRow,
      ] = await Promise.all([
        strapi.documents("plugin::content-moderation.submission").count({
          filters: {
            status: { $ne: "draft" },
            createdAt: { $gte: todayStart },
          },
        }),
        strapi
          .documents("api::library.library")
          .count({ status: "published", locale: "en" }),
        strapi.documents("api::user-profile.user-profile").count({}),
        strapi
          .documents("api::country.country")
          .count({ status: "published", locale: "en" }),
        // Distinct language codes across all contributor profiles: a
        // component table, so an aggregate on the connection.
        strapi.db.connection
          .table("components_profile_language_entries")
          .countDistinct("code as count")
          .first() as Promise<{ count: string | number } | undefined>,
      ])

      statsCache = {
        at: now,
        data: {
          submissionsToday: Number(submissionsToday ?? 0),
          indexedLibraries: Number(indexedLibraries ?? 0),
          totalContributors: Number(totalContributors ?? 0),
          totalCountries: Number(totalCountries ?? 0),
          totalLanguages: Number((languageRow as any)?.count ?? 0),
        },
      }
    }

    ctx.set("Cache-Control", `public, max-age=${STATS_TTL_MS / 1000}`)
    ctx.body = { data: statsCache.data }
  },

  // POST /api/content-moderation/submissions  (content-api route)
  async create(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }
    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
      verificationMethod,
      editSummary,
      evidenceType,
      evidenceUrl,
      asDraft,
      draftData,
      locale,
      driveDocumentId,
      staffCreation: requestedStaffCreation,
    } = ctx.request.body as Record<string, unknown>

    if (!submissionType) {
      return ctx.badRequest("submissionType is required")
    }
    let staffCreation
    if (requestedStaffCreation !== undefined) {
      if (submissionType !== "new_library")
        return ctx.badRequest("Staff creation is only for new libraries.")
      try {
        staffCreation = await resolveStaffLibraryCreation(
          strapi,
          user.id,
          requestedStaffCreation
        )
      } catch (error) {
        if (!(error instanceof AccessError)) throw error
        sendVerdict(ctx, { status: error.status, message: error.code })

        return
      }
    }

    // Event Feed submissions carry a reference to an encrypted credential and
    // are created only by the events plugin (POST /api/events/feeds), never
    // from a client body.
    if (submissionType === "network_claim")
      return ctx.badRequest("Use the service management request endpoint")
    if (submissionType === "event_feed") {
      ctx.status = 400
      ctx.body = {
        error: {
          status: 400,
          name: "use_event_feed_endpoint",
          message: "Connect an event feed from the event feeds page.",
        },
      }

      return
    }

    if (draftData !== undefined && !isValidDraftData(draftData)) {
      return ctx.badRequest("draftData must be an object under 256KB")
    }

    // The locale the service will store; direct edits are checked in it.
    const contentLocale = await resolveSubmissionLocale(strapi, locale, {
      submissionType,
      draftData,
    })
    const directWikiEdit =
      submissionType === "wiki_edit" && isDirectWikiEdit(draftData)
    const directJournalEdit =
      submissionType === "blog_submission" && isDirectJournalEdit(draftData)
    const verdict = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .check({
        baUserId: user.id,
        submissionType,
        // Types with their own field rules (role_application) check these.
        fields,
        targetEntityType,
        targetDocumentId,
        targetSlug,
        directWikiEdit,
        directJournalEdit,
        verificationMethod,
        evidenceType,
        evidenceUrl,
        locale: contentLocale,
        driveDocumentId,
        draftData,
      })
    if (!verdict.ok) {
      sendVerdict(ctx, verdict)

      return
    }
    // Drafts are private until finalize, which checks them again.
    const safe = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .checkContent(
        { fields, draftData, note, editSummary, evidenceUrl },
        { targetDocumentId, targetSlug }
      )
    if (!safe.ok) {
      sendVerdict(ctx, safe)

      return
    }

    const submission = await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType,
        ...(staffCreation ? { staffCreation } : {}),
        targetEntityType,
        targetDocumentId,
        targetSlug,
        fields,
        draftData,
        note,
        verificationMethod,
        editSummary,
        evidenceType,
        evidenceUrl,
        submittedByUserId: user.id,
        submittedByEmail: user.email,
        submittedByName: user.name,
        asDraft: !!asDraft,
        // Already normalised above; the service normalises it again.
        locale: contentLocale,
        ...(typeof driveDocumentId === "string" ? { driveDocumentId } : {}),
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/by-document-id/:documentId  (content-api route)
  // Returns public submissions for a given user-profile documentId.
  async findByDocumentId(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    if (!documentId) return ctx.badRequest("Missing documentId")

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findPublicByDocumentId(documentId)

    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/libraries/:documentId/history  (content-api route, public)
  // A library's published Change Batches, newest first. Field values (a Pro
  // feature, spec §9.1) only with `values=1`, the bridge secret and an
  // `X-Ba-User-Id` whose Entitlements, resolved here, include
  // `library.history`; everyone else gets field names.
  async libraryHistory(ctx: any) {
    const { documentId } = ctx.params as { documentId?: unknown }
    if (!isDocumentId(documentId)) return ctx.badRequest("Invalid documentId")
    const q = (ctx.query ?? {}) as Record<string, unknown>
    const wantsValues = q.values === "1" || q.values === "true"
    const values = wantsValues && (await mayReadHistoryValues(strapi, ctx))

    const result = await strapi
      .plugin("content-moderation")
      .service("history")
      .libraryHistory(documentId, {
        page: clampInt(q.page, PAGE),
        pageSize: clampInt(q.pageSize, PAGE_SIZE),
        values,
      })
    ctx.set("Cache-Control", values ? "no-store" : HISTORY_CACHE)
    ctx.body = result
  },

  // GET /api/content-moderation/libraries/:documentId/history/stats?months  (content-api route, public)
  async libraryHistoryStats(ctx: any) {
    const { documentId } = ctx.params as { documentId?: unknown }
    if (!isDocumentId(documentId)) return ctx.badRequest("Invalid documentId")
    const q = (ctx.query ?? {}) as Record<string, unknown>

    const data = await strapi
      .plugin("content-moderation")
      .service("history")
      .libraryHistoryStats(documentId, clampInt(q.months, MONTHS))
    ctx.set("Cache-Control", HISTORY_CACHE)
    ctx.body = { data }
  },

  // GET /api/content-moderation/articles/:kind/:documentId/history  (content-api route, public)
  // `kind` is `wiki` (Knowledge) or `blog` (Journal).
  async articleHistory(ctx: any) {
    const { kind, documentId } = ctx.params as {
      kind?: unknown
      documentId?: unknown
    }
    if (typeof kind !== "string" || !ARTICLE_KINDS.has(kind))
      return ctx.badRequest("kind must be wiki or blog")
    if (!isDocumentId(documentId)) return ctx.badRequest("Invalid documentId")
    const q = (ctx.query ?? {}) as Record<string, unknown>

    const result = await strapi
      .plugin("content-moderation")
      .service("history")
      .articleHistory(kind, documentId, {
        page: clampInt(q.page, PAGE),
        pageSize: clampInt(q.pageSize, PAGE_SIZE),
      })
    ctx.set("Cache-Control", HISTORY_CACHE)
    ctx.body = result
  },

  // GET /api/content-moderation/submissions/by-username/:username  (content-api route)
  // Returns public (non-draft) submissions for a given profile username.
  async findByUsername(ctx: any) {
    const { username } = ctx.params as { username: string }
    if (!username) return ctx.badRequest("Missing username")

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findPublicByUsername(username)

    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/submissions/my  (content-api route)
  async findMine(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const documentId = ctx.query?.documentId
    if (documentId !== undefined && !isDocumentId(documentId))
      return ctx.badRequest("Invalid submission id")
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(user.id, documentId)
    ctx.set("Cache-Control", "private, no-store")
    ctx.body = { data: submissions }
  },

  // GET /api/content-moderation/submissions/my/accepted-count  (content-api route)
  // How many of the caller's changes were accepted, Role Applications aside:
  // the Role Application eligibility count. Also the pending quota (`pending`
  // and `pendingLimit`, as the submission policy counts them), for "3 of 5
  // waiting for review". Bridge secret and X-Ba-User-Id only; the id is
  // trusted after the secret, never on its own.
  async acceptedCount(ctx: any) {
    const headers = ctx.request?.headers ?? {}
    const baUserId = headers["x-ba-user-id"]
    if (
      !isValidServiceSecret(headers["x-service-secret"]) ||
      typeof baUserId !== "string" ||
      !baUserId.trim()
    )
      return ctx.unauthorized("Service secret and user required.")
    const id = baUserId.trim()
    const [accepted, quota] = await Promise.all([
      countAccepted(strapi, id),
      strapi
        .plugin("content-moderation")
        .service("submission-policy")
        .pendingQuota(id) as Promise<{ pending: number; limit: number }>,
    ])
    ctx.set?.("Cache-Control", "no-store")
    ctx.body = {
      data: { accepted, pending: quota.pending, pendingLimit: quota.limit },
    }
  },

  // GET /content-moderation/relation-labels?type=services  (admin route only)
  // Resolves a relation type to a {documentId → name} map using the Document Service API.
  async relationLabels(ctx: any) {
    const { type } = ctx.query as { type?: string }

    const UID_MAP: Record<string, string> = {
      services: "api::service.service",
      amenities: "api::amenity.amenity",
      accessibility: "api::accessibility.accessibility",
    }

    const uid = type ? UID_MAP[type] : undefined
    if (!uid) {
      return ctx.badRequest(
        `Unknown relation type. Must be one of: ${Object.keys(UID_MAP).join(", ")}`
      )
    }

    try {
      // `findMany` ignores `pagination`; page with start/limit and a stable
      // sort instead.
      const results = await strapi.documents(uid).findMany({
        fields: ["documentId", "name"],
        start: 0,
        limit: 500,
        sort: { name: "asc" },
        status: "published",
      })

      const labels: Record<string, string> = {}
      for (const item of results ?? []) {
        if (item.documentId && item.name) {
          labels[item.documentId] = item.name
        }
      }

      ctx.body = { data: labels }
    } catch (err) {
      strapi.log.error("[content-moderation] relationLabels error", err)
      ctx.body = { data: {} }
    }
  },

  // PUT  /content-moderation/submissions/:id/status   (admin route only)
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { status, reviewNote, approvedLibraryIds } = (ctx.request.body ??
      {}) as {
      approvedLibraryIds?: string[]
      status: string
      reviewNote?: string
    }

    const VALID_STATUSES = ["approved", "rejected", "needs_info", "pending"]
    if (!VALID_STATUSES.includes(status)) {
      return ctx.badRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      )
    }

    await ensureFreshAdminApproval(strapi, ctx, id, status)

    // The admin user the route's policies authenticated. The service refuses
    // self-review (see utils/reviewer).
    const admin = ctx.state.user ?? ctx.state.admin
    const reviewer = adminReviewer({
      id: admin?.id ?? "unknown",
      email: admin?.email ?? null,
    })

    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(
        id,
        status,
        reviewer,
        reviewNote,
        ...(approvedLibraryIds ? [{ approvedLibraryIds }] : [])
      )

    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      if (result.error === "self_review")
        return ctx.forbidden("You can't review your own submission.")
      if (result.error === "apply_failed" && result.unreverted) {
        ctx.status = 500
        ctx.body = {
          error: {
            status: 500,
            name: "apply_failed_unreverted",
            message:
              "Approval could not be applied, and the submission could not be returned to review: it is marked with the new status but none of its side effects were applied. Check the server log and fix it manually.",
          },
        }

        return
      }
      if (result.error === "apply_failed") {
        ctx.status = 500
        ctx.body = {
          error: {
            status: 500,
            name: result.error,
            message:
              "Approval could not be applied; the submission was returned to review. Check the server log.",
          },
        }

        return
      }
      if (result.error === "apply_refused") {
        ctx.status = 409
        ctx.body = {
          error: {
            status: 409,
            name: "apply_refused",
            reason: result.reason,
            message:
              "The record this change applies to is not published, so nothing was applied. Publish it in the Content Manager, then approve again. The submission is back in review.",
          },
        }

        return
      }
      ctx.status = 409
      ctx.body = {
        error: {
          status: 409,
          name: result.error,
          message: `Cannot change status: ${result.error}`,
        },
      }

      return
    }
    ctx.body = { data: result.data }
  },

  // PATCH /api/content-moderation/submissions/:id/finalize  (content-api route)
  // Promotes a draft submission to "pending" — makes it visible to the moderation queue.
  async finalize(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    let body: Record<string, unknown>
    try {
      body = (await ctx.request.body) as Record<string, unknown>
    } catch {
      return ctx.badRequest("Invalid request body")
    }

    // C-5: ownership and status are checked inside `finalizeDraft` itself,
    // before the policy re-check below ever runs, so a request against
    // someone else's draft (or a non-draft row) always collapses to the
    // same 404 as a nonexistent id — no existence oracle via a 403 leaking
    // through first.
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .finalizeDraft(
        id,
        user.id,
        body,
        async (existing: any, next: { locale: string }) => {
          const policy = strapi
            .plugin("content-moderation")
            .service("submission-policy")
          // What goes to review: the fields `finalizeDraft` is about to write
          // (this body's, or the saved draft's when the body carries none)
          // plus this request's extras.
          const { locale: _locale, ...form } = (body ?? {}) as Record<
            string,
            unknown
          >
          const { fields, extras, hasFields } = splitSubmissionBody(form)
          const reviewedFields = hasFields ? fields : existing.fields
          const verdict = await policy.check({
            baUserId: user.id,
            submissionType: existing.submissionType,
            fields: reviewedFields,
            targetEntityType: existing.targetEntityType ?? undefined,
            targetDocumentId: existing.targetDocumentId ?? undefined,
            targetSlug: existing.targetSlug ?? undefined,
            directWikiEdit:
              existing.submissionType === "wiki_edit" &&
              isDirectWikiEdit(existing.draftData),
            directJournalEdit:
              existing.submissionType === "blog_submission" &&
              isDirectJournalEdit(existing.draftData),
            evidenceType: extras.evidenceType ?? existing.evidenceType,
            evidenceUrl: extras.evidenceUrl ?? existing.evidenceUrl,
            // C-4: this draft isn't `pending` yet, but excluding it keeps a
            // retried finalize from counting the row against its own quota.
            excludeDocumentId: id,
            locale: next.locale,
            driveDocumentId: existing.driveDocumentId ?? undefined,
            draftData: existing.draftData,
          })
          if (!verdict.ok) return verdict

          return policy.checkContent(
            {
              fields: reviewedFields,
              draftData: existing.draftData,
              note: extras.note ?? existing.note,
              editSummary: extras.editSummary ?? existing.editSummary,
              evidenceUrl: extras.evidenceUrl ?? existing.evidenceUrl,
            },
            {
              targetDocumentId: existing.targetDocumentId,
              targetSlug: existing.targetSlug,
            }
          )
        }
      )
    if (!result) {
      // `finalizeDraft` returns the same bare `null` for three different
      // reasons (missing/not-owned/no-longer-draft *before* the CAS, and a
      // revision-mismatched compare-and-set *after* it) so it can't tell us
      // which happened. Distinguish here, scoped to this caller's own
      // document (so it can't be used to probe whether someone else's
      // submission exists): if the row is still there, still ours, and
      // still `draft`, the only way `finalizeDraft` could have failed is
      // the revision race — a concurrent saveDraft landed after we read the
      // row — so that's retryable (409). Anything else collapses to the
      // same 404 as before.
      const after = await strapi
        .documents("plugin::content-moderation.submission")
        .findOne({ documentId: id })
      if (
        after &&
        after.submittedByUserId === user.id &&
        (after.status === "draft" || after.status === "needs_info")
      ) {
        ctx.status = 409
        ctx.body = {
          error: {
            status: 409,
            message: "The draft changed while submitting; please try again.",
          },
        }

        return
      }

      return ctx.notFound("Draft not found or already finalized.")
    }
    if ("error" in result && result.error === "policy") {
      sendVerdict(ctx, result.verdict)

      return
    }
    ctx.body = { data: result }
  },

  // POST /api/content-moderation/submissions/:id/withdraw — writer-owned articles only.
  async withdraw(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const id = ctx.params?.id
    const body = ctx.request.body
    if (
      !isDocumentId(id) ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.baseUpdatedAt !== "string" ||
      body.baseUpdatedAt.length > 40 ||
      !Number.isFinite(Date.parse(body.baseUpdatedAt))
    )
      return ctx.badRequest("Invalid withdrawal request")
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .withdrawArticle(id, user.id, body.baseUpdatedAt)
    if ("error" in result) {
      if (result.error === "not_found")
        return ctx.notFound("Submission not found")
      if (result.error === "invalid")
        return ctx.badRequest("Only article submissions can be withdrawn here")
      ctx.status = 409
      ctx.body = {
        error: {
          status: 409,
          message:
            "This submission changed. Reload its latest state before withdrawing.",
        },
      }

      return
    }
    ctx.set("Cache-Control", "no-store")
    ctx.body = { data: result.data }
  },

  // PATCH /api/content-moderation/submissions/:id/draft  (content-api route)
  async saveDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { draftData, stepCompleted } = (ctx.request.body ?? {}) as {
      draftData?: Record<string, unknown>
      stepCompleted?: number
    }
    if (draftData !== undefined && !isValidDraftData(draftData)) {
      return ctx.badRequest("draftData must be an object under 256KB")
    }
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .saveDraft(id, user.id, draftData ?? {}, Number(stepCompleted) || 0)
    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      if (result.error === "forbidden")
        return ctx.forbidden("You do not own this submission.")
      if (result.error === "invalid") return ctx.badRequest(result.message)
      if (typeof ctx.conflict === "function") {
        return ctx.conflict(
          "This submission is already in review and can't be edited."
        )
      }
      ctx.status = 409
      ctx.body = {
        error: {
          status: 409,
          message: "This submission is already in review and can't be edited.",
        },
      }

      return
    }
    ctx.body = { data: result.data }
  },

  // POST /api/content-moderation/uploads  (content-api route, secret-gated)
  async recordUpload(ctx: any) {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      return ctx.unauthorized("Service secret required")
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized()
    const fileId = Number((ctx.request.body as any)?.fileId)
    const reservationId = (ctx.request.body as any)?.reservationId
    if (
      !Number.isSafeInteger(fileId) ||
      fileId < 1 ||
      typeof reservationId !== "string" ||
      !/^[0-9a-f-]{36}$/.test(reservationId)
    )
      return ctx.badRequest("fileId and reservationId required")
    try {
      await completeUpload(strapi, user.id, reservationId, fileId)
    } catch (error) {
      ctx.status = error instanceof UploadReservationError ? error.status : 503
      ctx.body = {
        error:
          error instanceof UploadReservationError
            ? error.code
            : "upload_quota_unavailable",
      }

      return
    }
    ctx.body = { ok: true }
  },

  // GET /api/content-moderation/uploads/usage  (content-api route, secret-gated)
  // The user's uploads so far this UTC day, for the per-user upload quota
  // the Next.js upload routes enforce. Bridge secret only: the identity
  // header is trusted after the secret, never on its own.
  async uploadUsage(ctx: any) {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      return ctx.unauthorized("Service secret required.")
    const baUserId = ctx.request.headers["x-ba-user-id"]
    if (typeof baUserId !== "string" || !baUserId.trim())
      return ctx.badRequest("X-Ba-User-Id required")
    const usage = await strapi
      .plugin("content-moderation")
      .service("submission")
      .uploadUsage(baUserId.trim())
    ctx.set("Cache-Control", "no-store")
    ctx.body = usage
  },

  // GET /api/content-moderation/submissions/draft/:type  (content-api route)
  async findDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { type } = ctx.params as { type: string }
    const { targetSlug, locale, staffCreation } = ctx.query as {
      targetSlug?: unknown
      locale?: unknown
      staffCreation?: unknown
    }
    const draft = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findDraft(
        user.id,
        type,
        typeof targetSlug === "string" ? targetSlug : undefined,
        // Strings only (an object would be a filter); unknown → default.
        typeof locale === "string" ? locale : undefined,
        type === "new_library" && staffCreation === "true"
      )
    ctx.body = { data: draft }
  },
})

/**
 * Whether this request may read Change Record values: the bridge secret, a
 * Better Auth user id, and that user's Entitlements (resolved in Strapi from
 * the same rows as the session) include `library.history`. Never the
 * session's word alone.
 */
async function mayReadHistoryValues(strapi: any, ctx: any): Promise<boolean> {
  const headers = ctx.request?.headers ?? {}
  if (!isValidServiceSecret(headers["x-service-secret"])) return false
  const baUserId = headers["x-ba-user-id"]
  if (typeof baUserId !== "string" || !baUserId.trim()) return false
  try {
    const entitlements = await resolveUserEntitlements(strapi, baUserId.trim())

    return can(entitlements, "library.history")
  } catch (err) {
    strapi.log.warn(
      "[content-moderation] could not resolve entitlements for history values",
      err
    )

    return false
  }
}

// Resolves the calling user from the request.
// Accepts two auth patterns:
//   1. Service-to-service: X-Service-Secret header (from Next.js API routes) +
//      X-Ba-User-Id / X-Ba-User-Email / X-Ba-User-Name headers carrying identity
//   2. Better Auth session cookie (requires strapi-better-auth plugin)
//   3. Strapi users-permissions JWT in Authorization: Bearer header (fallback)
export async function resolveUser(
  strapi: any,
  ctx: any
): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    // Pattern 1: service-to-service via X-Service-Secret
    if (isValidServiceSecret(ctx.request.headers["x-service-secret"])) {
      const userId = ctx.request.headers["x-ba-user-id"] as string | undefined
      const userEmail = ctx.request.headers["x-ba-user-email"] as
        | string
        | undefined
      // Percent-encoded by the bridge (headers are Latin-1 only).
      const userName =
        decodeHeaderName(ctx.request.headers["x-ba-user-name"]) ?? ""
      if (userId && userEmail) {
        return { id: userId, email: userEmail, name: userName }
      }
    }

    // Pattern 2: strapi-better-auth plugin (when installed)
    if (strapi.betterAuth?.api?.getSession) {
      const session = await strapi.betterAuth.api.getSession({
        headers: ctx.request.headers,
      })

      return session?.user ?? null
    }

    // Pattern 3: Strapi users-permissions JWT
    if (ctx.state.user) {
      return {
        id: String(ctx.state.user.id),
        email: ctx.state.user.email,
        name: ctx.state.user.username,
      }
    }

    return null
  } catch {
    return null
  }
}
