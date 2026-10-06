import {
  type Capabilities,
  canDirectEdit,
  canModerate,
  canModerateApplication,
  isSubmissionType,
  MODERATION_QUEUES,
  type ModerationQueue,
  type ModerationScope,
  QUEUE_OF_SUBMISSION_TYPE,
  submissionTypesOfQueue,
  type SubmissionType,
} from "@repo/access"

import { acceptedCount } from "./submission-policy"
import { feedReview } from "../utils/feed-review"
import { isVerification, verifyReview } from "../utils/library-verify"
import { defaultLocale, knownLocale, submissionLocale } from "../utils/locales"
import { isNewArticleDraft, roleApplicationFields } from "../utils/params"
import { preloadTopicReviews, recordReview } from "../utils/record-review"
import { summaryOf } from "../utils/submission-summary"

/**
 * The Moderation Queue as community Moderators see it on the site
 * (`/contribute/moderation`): every read is filtered to the caller's
 * Moderation Scopes and never includes their own submissions. The
 * controller re-loads the caller's capabilities for every request and
 * passes them in; nothing here trusts a scope from the client.
 */

const SUBMISSION = "plugin::content-moderation.submission"
const PROFILE = "api::user-profile.user-profile"
const DRIVE = "api::drive.drive"
/** Accepted submissions listed on an application's review. */
const RECENT_ACCEPTED_MAX = 10
const REVIEW_EVENT = "plugin::content-moderation.review-event"
const ARTICLE_UID = {
  wiki_edit: "api::wiki-article.wiki-article",
  blog_submission: "api::blog-article.blog-article",
} as const

/** The list's status segments. `decided` is approved or rejected. */
export const LIST_STATUSES = ["pending", "needs_info", "decided"] as const
export type ListStatus = (typeof LIST_STATUSES)[number]

const STATUS_FILTER: Record<ListStatus, unknown> = {
  pending: { $eq: "pending" },
  needs_info: { $eq: "needs_info" },
  decided: { $in: ["approved", "rejected"] },
}

const OPEN = new Set(["pending", "needs_info"])

// The body's blocks, as the article pages populate them.
const BODY_POPULATE = {
  on: {
    "content.rich-text": true,
    "content.image-block": { populate: { image: true } },
    "content.code-block": true,
    "content.quote-block": true,
    "content.callout": true,
  },
}

// The columns a queue row is built from (never the email, hash, revision
// or assignee).
const ROW_FIELDS = [
  "documentId",
  "submissionType",
  "status",
  "contentLocale",
  "targetSlug",
  "submittedByName",
  "createdAt",
  "reviewedAt",
  "fields",
  "draftData",
  "driveDocumentId",
]

/** A Drive tag, as a row or detail carries it: resolved from the live Drive. */
export type DriveTag = { documentId: string; slug: string; title: string }

export type ModerationRow = {
  documentId: string
  submissionType: string
  queue: ModerationQueue
  status: string
  locale: string
  summary: string
  targetSlug: string | null
  submittedByName: string | null
  createdAt: string
  reviewedAt: string | null
  drive: DriveTag | null
}

type ArticleVersion = { title: unknown; summary: unknown; body: unknown }

/** Who applied, on a Role Application's review. */
export type ApplicantSummary = {
  username: string | null
  acceptedCount: number
  /** Newest first, at most 10; Role Applications don't count. */
  recentAccepted: { summary: string; type: string; decidedAt: string }[]
}

/**
 * Who is looking. `board`: the viewer's highest Role Grant is
 * `editorial_board`, the only Moderators who see and decide Moderator
 * applications.
 */
export type ViewerOptions = { board?: boolean }

export type ModerationDetail = ModerationRow & {
  targetDocumentId: string | null
  targetEntityType: string | null
  resultDocumentId: string | null
  fields: unknown
  draftData: unknown
  note: string | null
  editSummary: string | null
  evidenceType: string | null
  evidenceUrl: string | null
  reviewNote: string | null
  review: unknown | null
  article: {
    current: ArticleVersion | null
    source: (ArticleVersion & { locale: string }) | null
  } | null
  canPublish: boolean
  /** Role Applications only; null for every other type. */
  applicant: ApplicantSummary | null
}

export type ListQuery = {
  status: ListStatus
  queue?: ModerationQueue
  type?: SubmissionType
  locale?: string
  q?: string
  page: number
  pageSize: number
  /** A Drive's documentId: only submissions tagged with it. */
  drive?: string
}

/**
 * Rows in `locale`. A row with no stored locale (written before the
 * backfill) counts as the default locale's, as `loadInScope` and `toRow`
 * read it.
 */
export function localeFilter(
  locale: string,
  defaultCode: string
): Record<string, unknown> {
  return locale === defaultCode
    ? {
        $or: [
          { contentLocale: { $eq: locale } },
          { contentLocale: { $null: true } },
        ],
      }
    : { contentLocale: { $eq: locale } }
}

const APPLICATION = "role_application"

/** Matches no row: every document has a documentId. */
const NOTHING = { documentId: { $null: true } }

/**
 * The `$or` of the caller's scopes, or null when one of them covers every
 * queue in every locale (then there is nothing to filter by).
 *
 * A Role Application is filed in the default locale whatever languages it
 * asks for, so a locale-scoped scope can't select applications by locale.
 * `applicationIds` are the applications such a scope covers
 * (`canModerateApplication`, see `applicationIdsInScope`); without them a
 * locale-scoped scope covers no application. With `applicationsById` (a
 * viewer outside the editorial board, who must not see Moderator
 * applications) every scope covering applications selects them by id.
 */
export function scopeFilter(
  scopes: readonly ModerationScope[],
  defaultCode: string,
  applicationIds: readonly string[] = [],
  applicationsById = false
): Record<string, unknown> | null {
  const clauses: Record<string, unknown>[] = []
  let byId = false
  for (const s of scopes) {
    const types = s.queue === "all" ? null : submissionTypesOfQueue(s.queue)
    const coversApplications = !types || types.includes(APPLICATION)
    if (s.locale === null && !(applicationsById && coversApplications)) {
      if (!types) return null
      clauses.push({ submissionType: { $in: types } })
      continue
    }
    if (coversApplications) byId = true
    const others = types?.filter((t) => t !== APPLICATION)
    if (!others || others.length > 0) {
      const byType = {
        submissionType: others ? { $in: others } : { $ne: APPLICATION },
      }
      clauses.push(
        s.locale === null
          ? byType
          : { $and: [byType, localeFilter(s.locale, defaultCode)] }
      )
    }
  }
  if (byId && applicationIds.length > 0)
    clauses.push({
      submissionType: { $eq: APPLICATION },
      documentId: { $in: [...applicationIds] },
    })

  return { $or: clauses.length > 0 ? clauses : [NOTHING] }
}

/**
 * Whether reading the applications queue needs `applicationIdsInScope`.
 * By id (outside the board): any scope covers applications. Otherwise: some
 * scope covers applications only in one locale, and none covers them in
 * every locale.
 */
function needsApplicationIds(
  scopes: readonly ModerationScope[],
  applicationsById = false
): boolean {
  const covers = (s: ModerationScope) =>
    s.queue === "all" || s.queue === "applications"
  if (applicationsById) return scopes.some(covers)
  if (scopes.some((s) => covers(s) && s.locale === null)) return false

  return scopes.some((s) => covers(s) && s.locale !== null)
}

/** Open and decided applications read to resolve a locale-scoped queue. */
const APPLICATIONS_SCANNED = 1000

/** The queues any of the scopes covers, in the canonical order. */
export function queuesInScope(
  scopes: readonly ModerationScope[]
): ModerationQueue[] {
  if (scopes.some((s) => s.queue === "all")) return [...MODERATION_QUEUES]

  return MODERATION_QUEUES.filter((q) => scopes.some((s) => s.queue === q))
}

/** Filters shared by every read: in scope, not the viewer's, never a draft. */
function baseFilters(
  caps: Capabilities,
  viewer: string,
  defaultCode: string,
  applicationIds: readonly string[] = [],
  opts: ViewerOptions = {}
) {
  const scope = scopeFilter(
    caps.moderation,
    defaultCode,
    applicationIds,
    !opts.board
  )

  return [
    ...(scope ? [scope] : []),
    { submittedByUserId: { $ne: viewer } },
    { status: { $ne: "draft" } },
  ]
}

/** Whether a Knowledge/Journal draft is a suggestion (proposed content only). */
function isArticleSuggestion(draftData: unknown): boolean {
  if (!draftData || typeof draftData !== "object") return false
  const d = draftData as Record<string, unknown>
  if (isNewArticleDraft(d)) return false
  if (Array.isArray(d.body) || typeof d.title === "string") return false

  return (
    Array.isArray(d.proposedBody) ||
    typeof d.proposedTitle === "string" ||
    typeof d.proposedSummary === "string"
  )
}

/**
 * What a library claim's review needs from `fields` (see ClaimLibraryForm
 * and /api/profile/me/claim-library): the library, the claimant's role and
 * department, the method and the domain check. Anything else, such as a
 * phone number or an email address, is personal and stays out.
 */
const CLAIM_REVIEW_FIELDS = new Set([
  "name",
  "libraryName",
  "entityRef",
  "libraryDocumentId",
  "role",
  "department",
  "verificationMethod",
  "userEmailDomain",
  "claimedWebsiteDomain",
])

/** What an event_feed review may show from `fields`: never a value. */
const FEED_REVIEW_FIELDS = new Set([
  "kind",
  "credentialDocumentId",
  "provider",
  "hints",
  "previousHints",
  "test",
  // Not a secret: the library's own name, snapshotted at submission time so
  // the queue and alert email can name it without a live lookup (Finding 6).
  "libraryName",
])

/** `fields` as the moderator sees them. */
function reviewFields(s: { submissionType?: string; fields?: unknown }) {
  const f = s.fields
  if (!f || typeof f !== "object") return f ?? null
  const allow =
    s.submissionType === "library_claim"
      ? CLAIM_REVIEW_FIELDS
      : s.submissionType === "event_feed"
        ? FEED_REVIEW_FIELDS
        : null
  if (!allow) return f

  return Object.fromEntries(
    Object.entries(f as Record<string, unknown>).filter(([k]) => allow.has(k))
  )
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null)

export default ({ strapi }: { strapi: any }) => ({
  /** The submission's locale, the default when it has none stored. */
  async localeOf(s: any): Promise<string> {
    const stored = submissionLocale(s)

    return stored ?? defaultLocale(strapi)
  },

  /**
   * The submission when the viewer may review it (in scope, not their own,
   * not a draft), else null: out of scope looks the same as missing.
   */
  async loadInScope(
    caps: Capabilities,
    viewer: string,
    documentId: string,
    opts: ViewerOptions = {}
  ): Promise<any | null> {
    const s = await strapi.documents(SUBMISSION).findOne({ documentId })
    if (!s || s.status === "draft" || !isSubmissionType(s.submissionType))
      return null
    // An application's scope is the languages it asks for, not its stored
    // locale (always the default). Only the editorial board sees Moderator
    // applications.
    if (s.submissionType === APPLICATION) {
      const application = roleApplicationFields(s.fields)
      if (application.role === "moderator" && !opts.board) return null

      return canModerateApplication(
        caps,
        {
          locales: application.locales,
          submittedByUserId: s.submittedByUserId,
        },
        viewer
      )
        ? s
        : null
    }
    const allowed = canModerate(
      caps,
      {
        submissionType: s.submissionType,
        locale: await (this as any).localeOf(s),
        submittedByUserId: s.submittedByUserId,
      },
      viewer
    )

    return allowed ? s : null
  },

  /**
   * The Role Applications a locale-scoped Moderator may review, by
   * documentId: the languages an application asks for live in its JSON
   * `fields`, so they are checked here (`canModerateApplication`) rather
   * than in the query. Empty when no scope needs it (see
   * `needsApplicationIds`). Outside the editorial board, Moderator
   * applications are never among them. Applications are few; the newest
   * `APPLICATIONS_SCANNED` are read.
   */
  async applicationIdsInScope(
    caps: Capabilities,
    viewer: string,
    opts: ViewerOptions = {}
  ): Promise<string[]> {
    if (!needsApplicationIds(caps.moderation, !opts.board)) return []
    const rows = (await strapi.documents(SUBMISSION).findMany({
      filters: {
        submissionType: { $eq: APPLICATION },
        status: { $ne: "draft" },
        submittedByUserId: { $ne: viewer },
      },
      fields: ["documentId", "fields", "submittedByUserId"],
      sort: [{ createdAt: "desc" }, { id: "desc" }],
      limit: APPLICATIONS_SCANNED,
    })) as {
      documentId: string
      fields?: unknown
      submittedByUserId: string
    }[]

    return (rows ?? [])
      .filter((r) => {
        const application = roleApplicationFields(r.fields)
        if (application.role === "moderator" && !opts.board) return false

        return canModerateApplication(
          caps,
          {
            locales: application.locales,
            submittedByUserId: r.submittedByUserId,
          },
          viewer
        )
      })
      .map((r) => r.documentId)
  },

  /**
   * Resolves distinct Drive documentIds to `{ documentId, slug, title }` in
   * one query, for a page of rows (`list`) or a single one (`toRow` without
   * a preloaded map, as `detail` calls it).
   */
  async driveTitles(ids: readonly (string | null | undefined)[]) {
    const distinct = [...new Set(ids.filter((id): id is string => !!id))]
    const map = new Map<string, DriveTag>()
    if (distinct.length === 0) return map
    const rows = (await strapi.documents(DRIVE).findMany({
      filters: { documentId: { $in: distinct } },
      fields: ["documentId", "slug", "title"],
      limit: distinct.length,
    })) as { documentId: string; slug?: string; title?: string }[]
    for (const r of rows)
      map.set(r.documentId, {
        documentId: r.documentId,
        slug: r.slug ?? "",
        title: r.title ?? "",
      })

    return map
  },

  async toRow(
    s: any,
    driveMap?: Map<string, DriveTag>
  ): Promise<ModerationRow> {
    const driveId: string | null = s.driveDocumentId ?? null
    const drive = driveId
      ? ((driveMap ?? (await (this as any).driveTitles([driveId]))).get(
          driveId
        ) ?? null)
      : null

    return {
      documentId: s.documentId,
      submissionType: s.submissionType,
      queue: QUEUE_OF_SUBMISSION_TYPE[s.submissionType as SubmissionType],
      status: s.status,
      locale: await (this as any).localeOf(s),
      summary: summaryOf(s),
      targetSlug: s.targetSlug ?? null,
      submittedByName: s.submittedByName ?? null,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt ?? null,
      drive,
    }
  },

  async list(
    caps: Capabilities,
    viewer: string,
    query: ListQuery,
    opts: ViewerOptions = {}
  ): Promise<{
    data: ModerationRow[]
    meta: { page: number; pageSize: number; total: number }
  }> {
    const and: Record<string, unknown>[] = [
      ...baseFilters(
        caps,
        viewer,
        await defaultLocale(strapi),
        await (this as any).applicationIdsInScope(caps, viewer, opts),
        opts
      ),
      { status: STATUS_FILTER[query.status] },
    ]
    if (query.queue)
      and.push({ submissionType: { $in: submissionTypesOfQueue(query.queue) } })
    if (query.type) and.push({ submissionType: { $eq: query.type } })
    if (query.locale)
      and.push(localeFilter(query.locale, await defaultLocale(strapi)))
    if (query.drive) and.push({ driveDocumentId: { $eq: query.drive } })
    if (query.q)
      // Never the email: personal data the queue doesn't need to search.
      and.push({
        $or: ["submittedByName", "targetSlug", "editSummary", "note"].map(
          (k) => ({ [k]: { $containsi: query.q } })
        ),
      })
    const filters = { $and: and }

    const [total, rows] = await Promise.all([
      strapi.documents(SUBMISSION).count({ filters }),
      strapi.documents(SUBMISSION).findMany({
        filters,
        fields: ROW_FIELDS,
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        start: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
      }),
    ])
    const driveMap = await (this as any).driveTitles(
      (rows ?? []).map((r: any) => r.driveDocumentId)
    )
    const data: ModerationRow[] = []
    for (const s of rows ?? [])
      if (isSubmissionType(s.submissionType))
        data.push(await (this as any).toRow(s, driveMap))

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: Number(total ?? 0),
      },
    }
  },

  /** What the review needs to know, read from Strapi, never the contributor. */
  async review(s: any): Promise<unknown | null> {
    if (!OPEN.has(s.status)) return null
    if (s.submissionType === "topic_suggestion")
      return (
        (await preloadTopicReviews(strapi, [s])).get(s.targetDocumentId) ?? null
      )
    if (s.submissionType === "correction")
      return isVerification(s.fields)
        ? verifyReview(strapi, s).catch(() => null)
        : recordReview(strapi, s).catch(() => null)
    if (s.submissionType === "library_edit") {
      // A claimant's edit is a record edit whatever `fields.kind` says.
      const fields = s.fields && typeof s.fields === "object" ? s.fields : {}

      return recordReview(strapi, {
        ...s,
        fields: { ...fields, kind: "record" },
      }).catch(() => null)
    }
    if (s.submissionType === "event_feed")
      return feedReview(strapi, s).catch(() => null)

    return null
  },

  /** One version of the article a submission targets, as it is live. */
  async articleVersion(
    uid: string,
    slug: string,
    locale: string
  ): Promise<ArticleVersion | null> {
    const [row] = (await strapi.documents(uid).findMany({
      filters: { slug: { $eq: slug } },
      locale,
      status: "published",
      fields: ["documentId", "title", "summary", "locale"],
      populate: { body: BODY_POPULATE },
      limit: 1,
    })) as Record<string, unknown>[]
    if (!row) return null

    return {
      title: row.title ?? null,
      summary: row.summary ?? null,
      body: row.body ?? null,
    }
  },

  async article(s: any, locale: string): Promise<ModerationDetail["article"]> {
    const uid =
      ARTICLE_UID[s.submissionType as keyof typeof ARTICLE_UID] ?? null
    if (!uid || isNewArticleDraft(s.draftData) || !s.targetSlug) return null
    const current = await (this as any).articleVersion(
      uid,
      s.targetSlug,
      locale
    )
    const d = (s.draftData ?? {}) as Record<string, unknown>
    let source: (ArticleVersion & { locale: string }) | null = null
    if (d.isTranslation === true) {
      const sourceLocale =
        (await knownLocale(strapi, d.sourceLocale)) ??
        (await defaultLocale(strapi))
      if (sourceLocale !== locale) {
        const v = await (this as any).articleVersion(
          uid,
          s.targetSlug,
          sourceLocale
        )
        if (v) source = { locale: sourceLocale, ...v }
      }
    }

    return { current, source }
  },

  /**
   * Whether "Approve and publish" applies: an article suggestion or a new
   * article that wouldn't publish by itself (its author can't publish in
   * this locale), or a new library. The caller has already checked the
   * viewer's scope covers the submission's queue and locale.
   */
  async canPublish(s: any, locale: string): Promise<boolean> {
    // A decided submission has nothing left to publish.
    if (!OPEN.has(s.status)) return false
    if (s.submissionType === "new_library") return true
    if (
      s.submissionType !== "wiki_edit" &&
      s.submissionType !== "blog_submission"
    )
      return false
    if (isArticleSuggestion(s.draftData)) return true
    if (!isNewArticleDraft(s.draftData)) return false
    const { caps } = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .loadCapabilities(s.submittedByUserId)
    const editor = s.submissionType === "wiki_edit" ? "docs" : "journal"

    return !canDirectEdit(caps, editor, locale)
  },

  /**
   * A Role Application's applicant: their username, how many of their
   * submissions were accepted and the latest ten (applications excluded,
   * the same count the eligibility rule reads). Null for any other type.
   */
  async applicant(s: any): Promise<ApplicantSummary | null> {
    if (s.submissionType !== APPLICATION) return null
    const baUserId = str(s.submittedByUserId)
    if (!baUserId)
      return { username: null, acceptedCount: 0, recentAccepted: [] }
    const [profiles, count, recent] = await Promise.all([
      strapi.documents(PROFILE).findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: ["username"],
        limit: 1,
      }) as Promise<{ username?: string | null }[]>,
      acceptedCount(strapi, baUserId),
      strapi.documents(SUBMISSION).findMany({
        filters: {
          submittedByUserId: { $eq: baUserId },
          status: { $eq: "approved" },
          submissionType: { $ne: APPLICATION },
        },
        fields: [
          "submissionType",
          "targetSlug",
          "fields",
          "draftData",
          "reviewedAt",
          "updatedAt",
        ],
        sort: [{ reviewedAt: "desc" }, { id: "desc" }],
        limit: RECENT_ACCEPTED_MAX,
      }) as Promise<Record<string, any>[]>,
    ])

    return {
      username: str(profiles?.[0]?.username) || null,
      acceptedCount: count,
      recentAccepted: (recent ?? []).map((r) => ({
        summary: summaryOf(r as any),
        type: String(r.submissionType),
        decidedAt: String(r.reviewedAt ?? r.updatedAt ?? ""),
      })),
    }
  },

  async detail(s: any): Promise<ModerationDetail> {
    const row: ModerationRow = await (this as any).toRow(s)
    const [review, article, canPublish, applicant] = await Promise.all([
      (this as any).review(s),
      (this as any).article(s, row.locale),
      (this as any).canPublish(s, row.locale),
      (this as any).applicant(s),
    ])

    return {
      ...row,
      targetDocumentId: s.targetDocumentId ?? null,
      targetEntityType: s.targetEntityType ?? null,
      resultDocumentId: s.resultDocumentId ?? null,
      fields: reviewFields(s),
      draftData: s.draftData ?? null,
      note: str(s.note),
      editSummary: str(s.editSummary),
      evidenceType: str(s.evidenceType),
      evidenceUrl: str(s.evidenceUrl),
      reviewNote: str(s.reviewNote),
      review: review ?? null,
      article,
      canPublish,
      applicant: applicant ?? null,
    }
  },

  /** The submission's Review Events, oldest first. */
  async events(documentId: string, viewer: string) {
    const rows = (await strapi.documents(REVIEW_EVENT as any).findMany({
      filters: { submissionDocumentId: { $eq: documentId } },
      sort: [{ createdAt: "asc" }, { id: "asc" }],
      limit: 200,
    })) as Record<string, any>[]

    return rows.map((e) => ({
      documentId: e.documentId,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      reviewerKind: e.reviewerKind ?? null,
      byViewer: e.reviewerId === `ba:${viewer}`,
      note: e.note ?? null,
      createdAt: e.createdAt,
    }))
  },

  /** Counts per queue and list status, within the viewer's scope. */
  async stats(caps: Capabilities, viewer: string, opts: ViewerOptions = {}) {
    const base = baseFilters(
      caps,
      viewer,
      await defaultLocale(strapi),
      await (this as any).applicationIdsInScope(caps, viewer, opts),
      opts
    )
    const cells = queuesInScope(caps.moderation).flatMap((queue) =>
      LIST_STATUSES.map((status) => ({ queue, status }))
    )
    const counts = await Promise.all(
      cells.map(({ queue, status }) =>
        strapi.documents(SUBMISSION).count({
          filters: {
            $and: [
              ...base,
              { submissionType: { $in: submissionTypesOfQueue(queue) } },
              { status: STATUS_FILTER[status] },
            ],
          },
        })
      )
    )

    return cells.map((c, i) => ({ ...c, count: Number(counts[i] ?? 0) }))
  },
})
