/**
 * drive service.
 *
 * `draftAndPublish` is off for `api::drive.drive` (its `schema.json`): the
 * content type's own lifecycle is the `status` attribute
 * (draft/scheduled/open/closed/cancelled), and naming it `status` collides
 * with the Document Service's reserved draft/publish meta-field when
 * `draftAndPublish` is on — Strapi still boots, but logs a warning on every
 * boot in that case. With it off, every write is live immediately, so no
 * `documents()` call needs (or accepts) its own `status` option; `toPublic`
 * strips the two board-only fields unconditionally, so a programming
 * mistake in a field list can never leak them.
 */

import {
  DRIVE_MAX_PINNED,
  focusMatches,
  libraryInScope,
  validateDrive,
  type DriveFocus,
  type DriveInput,
  type DriveScope,
} from "@repo/shared-data"
import { factories } from "@strapi/strapi"

import { isActivityPublic } from "../../../utils/activity-visibility"
import { loadDriveLibrary } from "../../../utils/drive-library"

const UID = "api::drive.drive"
const DRIVE_CREDIT = "api::drive-credit.drive-credit"
const SUBMISSION = "cm_submissions"
const CREDIT = "drive_credits"

type DriveRow = Record<string, unknown> & {
  documentId: string
  status?: string
  pinned?: boolean
  featured?: boolean
}

const PRIVATE_FIELDS = [
  "createdByUserId",
  "proposalSubmissionDocumentId",
] as const

/** The fields a public read is allowed to carry. */
const PUBLIC_FIELDS = [
  "documentId",
  "title",
  "slug",
  "summary",
  "focus",
  "scope",
  "unit",
  "startsAt",
  "endsAt",
  "goalPercent",
  "status",
  "closedReason",
  "pinned",
  "pinOrder",
  "featured",
  "openedAt",
  "closedAt",
  "baseline",
  "progressLog",
  "final",
  "locale",
  "createdAt",
  "updatedAt",
  "publishedAt",
] as const

/** The lifecycle states a public reader may ask `listPublic` for. */
const PUBLIC_STATES = ["open", "scheduled", "closed"] as const
type PublicState = (typeof PUBLIC_STATES)[number]

/** Lifecycle states that can no longer be pinned, featured or cancelled. */
const SETTLED_STATES = new Set(["closed", "cancelled"])

/** Fields a board write may edit on a drive that has left draft/scheduled. */
const TEXT_FIELDS = new Set<keyof DriveInput>([
  "title",
  "summary",
  "steps",
  "whereToLook",
])

type ServiceResult<T> = { data: T } | { errors: string[]; status?: number }

function toPublic(row: DriveRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    if ((PRIVATE_FIELDS as readonly string[]).includes(key)) continue
    out[key] = row[key]
  }

  return out
}

/** URL-safe slug from a title; falls back to "drive". */
function slugify(title: string): string {
  const s = (title ?? "")
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80)

  return s || "drive"
}

/** A slug none of today's drives already hold, across every locale. */
async function uniqueSlug(
  strapi: any,
  base: string,
  excludeDocumentId?: string
): Promise<string> {
  const rows = (await strapi.documents(UID).findMany({
    filters: { slug: { $startsWith: base } },
    locale: "*",
    fields: ["documentId", "slug"],
    limit: 200,
  })) as { documentId: string; slug?: string }[]
  const taken = new Set(
    rows.filter((r) => r.documentId !== excludeDocumentId).map((r) => r.slug)
  )
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }

  return `${base}-${Date.now()}`
}

async function countPinnedOpenOrScheduled(strapi: any): Promise<number> {
  return strapi.documents(UID).count({
    filters: {
      pinned: { $eq: true },
      status: { $in: ["open", "scheduled"] },
    },
  })
}

function stepsToComponent(steps: string[]) {
  return steps.map((text) => ({ text }))
}

function stepsFromRow(row: DriveRow): string[] {
  const steps = row.steps
  if (!Array.isArray(steps)) return []

  return steps
    .map((s) =>
      s && typeof s === "object" ? (s as { text?: unknown }).text : s
    )
    .filter((t): t is string => typeof t === "string")
}

/** Submission types `creditApproval` credits — library changes only. */
const CREDITABLE_TYPES = new Set(["correction", "library_edit"])
/** `openDrivesCached`'s cap — a generous ceiling on concurrently open Drives. */
const OPEN_DRIVES_MAX = 50
const OPEN_DRIVES_TTL_MS = 60_000
/** A distinct-id list's cap for `countHelpers`'s in-JS union (ADR-0004). */
const HELPER_ID_CAP = 10_000
const LEADERBOARD_MAX = 20

type OpenDriveRow = {
  documentId: string
  scope: DriveScope
  focus: DriveFocus
  openedAt?: string | null
}

// Every open drive, scope and focus only, memoised for 60s per strapi
// instance (tests get their own fake, so they never share this). `status:
// "open"` is the only "published" a drive needs — `draftAndPublish` is off
// for this content type (see the file header).
const openDrivesCache = new WeakMap<
  object,
  { expires: number; value: OpenDriveRow[] }
>()

async function openDrivesCached(strapiInstance: any): Promise<OpenDriveRow[]> {
  const cached = openDrivesCache.get(strapiInstance)
  if (cached && cached.expires > Date.now()) return cached.value

  const rows = (await strapiInstance.documents(UID).findMany({
    filters: { status: { $eq: "open" } },
    fields: ["documentId", "scope", "focus", "openedAt"],
    limit: OPEN_DRIVES_MAX,
  })) as OpenDriveRow[]

  openDrivesCache.set(strapiInstance, {
    expires: Date.now() + OPEN_DRIVES_TTL_MS,
    value: rows,
  })

  return rows
}

/**
 * Creates one Drive Credit, swallowing a duplicate `(submissionDocumentId,
 * driveDocumentId)` — a retried approval, or the same untagged match found
 * twice — the same way the rewards plugin catches a duplicate point event
 * or badge award (`code === "23505"`).
 */
async function creditOne(
  strapiInstance: any,
  data: {
    driveDocumentId: string
    baUserId: string
    submissionDocumentId: string
    libraryDocumentId: string
    tagged: boolean
  }
): Promise<void> {
  try {
    await strapiInstance.documents(DRIVE_CREDIT).create({
      data: { ...data, acceptedAt: new Date().toISOString() } as never,
    })
  } catch (err: any) {
    if (err?.code === "23505" || err?.nativeError?.code === "23505") return
    throw err
  }
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  // ── Public reads ──────────────────────────────────────────────────────────

  /**
   * Drives in `state` (`open`, `scheduled` or `closed` only — a `draft` or
   * `cancelled` drive is never public), pinned first then by `pinOrder` then
   * `startsAt` (closed drives: by `closedAt` desc instead). `limit` is
   * capped at 50; closed drives default to 5.
   */
  async listPublic(
    state?: string,
    limit?: number,
    locale = "en"
  ): Promise<Record<string, unknown>[]> {
    const normalisedState: PublicState = (
      PUBLIC_STATES as readonly string[]
    ).includes(state as string)
      ? (state as PublicState)
      : "open"
    const defaultLimit = normalisedState === "closed" ? 5 : 50
    const take = Math.min(
      typeof limit === "number" && limit > 0 ? Math.trunc(limit) : defaultLimit,
      50
    )
    const sort = (
      normalisedState === "closed"
        ? ["closedAt:desc"]
        : ["pinned:desc", "pinOrder:asc", "startsAt:asc"]
    ) as never

    const rows = (await strapi.documents(UID).findMany({
      filters: { status: { $eq: normalisedState } },
      locale,
      sort,
      limit: take,
      fields: [...PUBLIC_FIELDS] as never,
      populate: { steps: true, whereToLook: true },
    })) as DriveRow[]

    return rows.map((row) => toPublic(row))
  },

  /** The one drive with this slug, or null — never a `draft` (unpublished). */
  async bySlug(
    slug: string,
    locale = "en"
  ): Promise<Record<string, unknown> | null> {
    const rows = (await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug }, status: { $ne: "draft" } },
      locale,
      fields: [...PUBLIC_FIELDS] as never,
      populate: { steps: true, whereToLook: true },
      limit: 1,
    })) as DriveRow[]

    return rows[0] ? toPublic(rows[0]) : null
  },

  // ── Board writes ──────────────────────────────────────────────────────────

  /**
   * Creates a drive in `status: "scheduled"`, slugged from its title.
   * Refused with `validateDrive`'s errors, or with a 409 when `pinned` is
   * requested and six open/scheduled drives are already pinned.
   */
  async createDrive(
    input: Partial<DriveInput> & { pinned?: boolean },
    baUserId: string
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const errors = validateDrive(input as DriveInput, new Date())
    if (errors.length > 0) return { errors }

    const pinned = Boolean(input.pinned)
    if (
      pinned &&
      (await countPinnedOpenOrScheduled(strapi)) >= DRIVE_MAX_PINNED
    ) {
      return { errors: ["Six drives are already pinned."], status: 409 }
    }

    const slug = await uniqueSlug(strapi, slugify(input.title!))

    const created = (await strapi.documents(UID).create({
      data: {
        title: input.title,
        slug,
        summary: input.summary,
        steps: stepsToComponent(input.steps!),
        focus: input.focus,
        scope: input.scope,
        whereToLook: input.whereToLook,
        unit: input.unit,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        goalPercent: input.goalPercent,
        status: "scheduled",
        pinned,
        createdByUserId: `ba:${baUserId}`,
      } as never,
    })) as DriveRow

    return { data: toPublic(created) }
  },

  /**
   * Updates a drive. Allowed at any status for the text fields (`title`,
   * `summary`, `steps`, `whereToLook`); every other field only while the
   * drive is `draft` or `scheduled`. The merged result is re-validated with
   * `validateDrive`.
   */
  async updateDrive(
    documentId: string,
    input: Partial<DriveInput>
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const existing = (await strapi.documents(UID).findOne({
      documentId,
      populate: { steps: true, whereToLook: true },
    })) as DriveRow | null
    if (!existing) return { errors: ["Drive not found."], status: 404 }

    // Only count fields the body actually sent — `driveInputFromBody` drops
    // `undefined` keys, but a defensive filter here means a caller that
    // doesn't can't accidentally 409 a pure text edit.
    const lifecycleLocked =
      existing.status !== "draft" && existing.status !== "scheduled"
    if (lifecycleLocked) {
      const disallowed = (Object.keys(input) as (keyof DriveInput)[]).filter(
        (key) =>
          !TEXT_FIELDS.has(key) &&
          (input as Record<string, unknown>)[key] !== undefined
      )
      if (disallowed.length > 0) {
        return {
          errors: [
            `Only the title, summary, steps and where-to-look can change once a drive is ${existing.status}.`,
          ],
          status: 409,
        }
      }
    }

    const merged: DriveInput = {
      title: input.title ?? (existing.title as string),
      summary: input.summary ?? (existing.summary as string),
      steps: input.steps ?? stepsFromRow(existing),
      focus: (input.focus ?? existing.focus) as DriveInput["focus"],
      scope: (input.scope ?? existing.scope) as DriveInput["scope"],
      unit: (input.unit ?? existing.unit) as DriveInput["unit"],
      startsAt: (input.startsAt ?? existing.startsAt) as string,
      endsAt: (input.endsAt ?? existing.endsAt) as string,
      goalPercent: (input.goalPercent ?? existing.goalPercent) as number,
      whereToLook: (input.whereToLook ??
        existing.whereToLook) as DriveInput["whereToLook"],
    }
    const errors = validateDrive(merged, new Date())
    if (errors.length > 0) return { errors }

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = input.title
    if (input.summary !== undefined) data.summary = input.summary
    if (input.steps !== undefined) data.steps = stepsToComponent(input.steps)
    if (input.whereToLook !== undefined) data.whereToLook = input.whereToLook
    if (input.focus !== undefined) data.focus = input.focus
    if (input.scope !== undefined) data.scope = input.scope
    if (input.unit !== undefined) data.unit = input.unit
    if (input.startsAt !== undefined) data.startsAt = input.startsAt
    if (input.endsAt !== undefined) data.endsAt = input.endsAt
    if (input.goalPercent !== undefined) data.goalPercent = input.goalPercent

    const updated = (await strapi.documents(UID).update({
      documentId,
      data: data as never,
    })) as DriveRow

    return { data: toPublic(updated) }
  },

  /**
   * Board-only lifecycle actions. `open` and `close` are implemented in
   * Task 6 and answer "Unknown action" until then, same as any unrecognised
   * action. `pin`, `feature` and `cancel` refuse once a drive has settled
   * (`closed` or `cancelled`) — a closed drive's `closedReason`/`closedAt`
   * is never overwritten, and a settled drive can't be promoted back onto
   * the Noticeboard's pinned rail.
   */
  async act(
    documentId: string,
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const existing = (await strapi.documents(UID).findOne({
      documentId,
    })) as DriveRow | null
    if (!existing) return { errors: ["Drive not found."], status: 404 }
    const settled = SETTLED_STATES.has(existing.status ?? "")
    const settledWord = existing.status === "cancelled" ? "cancelled" : "closed"

    switch (action) {
      case "pin": {
        if (settled) {
          return {
            errors: [`A ${settledWord} drive can't be pinned.`],
            status: 409,
          }
        }
        if (!existing.pinned) {
          const pinnedCount = await countPinnedOpenOrScheduled(strapi)
          if (pinnedCount >= DRIVE_MAX_PINNED) {
            return { errors: ["Six drives are already pinned."], status: 409 }
          }
        }
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: { pinned: true } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      case "unpin": {
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: { pinned: false, featured: false } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      case "feature": {
        if (settled) {
          return {
            errors: [`A ${settledWord} drive can't be featured.`],
            status: 409,
          }
        }
        if (!existing.pinned) {
          return {
            errors: ["Only a pinned drive can be featured."],
            status: 409,
          }
        }
        const others = (await strapi.documents(UID).findMany({
          filters: {
            featured: { $eq: true },
            documentId: { $ne: documentId },
          },
          fields: ["documentId"],
          limit: DRIVE_MAX_PINNED,
        })) as { documentId: string }[]
        for (const other of others) {
          await strapi.documents(UID).update({
            documentId: other.documentId,
            data: { featured: false } as never,
          })
        }
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: { featured: true } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      case "unfeature": {
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: { featured: false } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      case "cancel": {
        if (settled) {
          return {
            errors: [
              existing.status === "cancelled"
                ? "This drive has already been cancelled."
                : "This drive has already closed.",
            ],
            status: 409,
          }
        }
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: {
            status: "cancelled",
            closedReason: "cancelled",
            closedAt: new Date().toISOString(),
            pinned: false,
            featured: false,
          } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      case "reorder": {
        const pinOrder = payload.pinOrder
        if (typeof pinOrder !== "number" || !Number.isFinite(pinOrder)) {
          return { errors: ["pinOrder must be a number."], status: 400 }
        }
        const updated = (await strapi.documents(UID).update({
          documentId,
          data: { pinOrder } as never,
        })) as DriveRow

        return { data: toPublic(updated) }
      }

      default:
        // "open" and "close" land here too until Task 6 implements them.
        return { errors: ["Unknown action"], status: 400 }
    }
  },

  // ── Credits, stats and leaderboards ────────────────────────────────────────

  /**
   * Credits an approved `correction` or `library_edit` on a library target.
   * Tagged (the submission named a Drive at submit time, already checked
   * in scope and on-focus by the submission policy) credits that one
   * Drive. Untagged, every open Drive whose scope and focus the change
   * matches is credited — the library is loaded once either way, as the
   * policy does. Not a library target (no library found): credits nothing.
   * A second approval of the same submission (a retried transition)
   * credits nothing twice: `creditOne` swallows the duplicate-key error the
   * unique `(submissionDocumentId, driveDocumentId)` index throws.
   */
  async creditApproval(submission: {
    documentId: string
    submissionType: string
    driveDocumentId?: string | null
    targetDocumentId?: string | null
    targetSlug?: string | null
    fields?: unknown
    submittedByUserId: string
  }): Promise<void> {
    if (!CREDITABLE_TYPES.has(submission.submissionType)) return

    const library = await loadDriveLibrary(strapi, {
      targetDocumentId: submission.targetDocumentId,
      targetSlug: submission.targetSlug,
    })
    if (!library) return

    if (
      typeof submission.driveDocumentId === "string" &&
      submission.driveDocumentId
    ) {
      await creditOne(strapi, {
        driveDocumentId: submission.driveDocumentId,
        baUserId: submission.submittedByUserId,
        submissionDocumentId: submission.documentId,
        libraryDocumentId: library.documentId,
        tagged: true,
      })

      return
    }

    const drives = await openDrivesCached(strapi)
    for (const drive of drives) {
      if (!libraryInScope(library, drive.scope, drive.openedAt)) continue
      if (
        !focusMatches(drive.focus, {
          submissionType: submission.submissionType,
          fields: submission.fields,
        })
      )
        continue
      await creditOne(strapi, {
        driveDocumentId: drive.documentId,
        baUserId: submission.submittedByUserId,
        submissionDocumentId: submission.documentId,
        libraryDocumentId: library.documentId,
        tagged: false,
      })
    }
  },

  /** Count of `cm_submissions` still in review (`pending`/`needs_info`) for this Drive. */
  async countInReview(documentId: string): Promise<number> {
    const rows = (await strapi.db.connection
      .count({ count: "*" })
      .from(SUBMISSION)
      .where("drive_document_id", documentId)
      .whereIn("status", ["pending", "needs_info"])) as {
      count: string | number
    }[]

    return Number(rows[0]?.count ?? 0)
  },

  /** Count of Drive Credits recorded for this Drive. */
  async countCredits(documentId: string): Promise<number> {
    const rows = (await strapi.db.connection
      .count({ count: "*" })
      .from(CREDIT)
      .where("drive_document_id", documentId)) as { count: string | number }[]

    return Number(rows[0]?.count ?? 0)
  },

  /**
   * Count of distinct helpers for this Drive: the union of everyone
   * credited and everyone with a non-draft Submission tagged to it. Two
   * capped (10,000) distinct-id lists, unioned in JS (ADR-0004) rather than
   * one SQL UNION, so the same grouped-query shape as every other count
   * here is enough.
   */
  async countHelpers(documentId: string): Promise<number> {
    const [creditRows, submissionRows] = (await Promise.all([
      strapi.db.connection
        .select("ba_user_id")
        .from(CREDIT)
        .where("drive_document_id", documentId)
        .groupBy("ba_user_id")
        .limit(HELPER_ID_CAP),
      strapi.db.connection
        .select("submitted_by_user_id")
        .from(SUBMISSION)
        .where("drive_document_id", documentId)
        .whereNot("status", "draft")
        .groupBy("submitted_by_user_id")
        .limit(HELPER_ID_CAP),
    ])) as [{ ba_user_id: string }[], { submitted_by_user_id: string }[]]

    const ids = new Set<string>()
    for (const r of creditRows) ids.add(r.ba_user_id)
    for (const r of submissionRows) ids.add(r.submitted_by_user_id)

    return ids.size
  },

  /** `{ inReview, helpers, credits }` for a Drive's progress card. */
  async stats(
    documentId: string
  ): Promise<{ inReview: number; helpers: number; credits: number }> {
    const [inReview, helpers, credits] = await Promise.all([
      (this as any).countInReview(documentId),
      (this as any).countHelpers(documentId),
      (this as any).countCredits(documentId),
    ])

    return { inReview, helpers, credits }
  },

  /** Credits per helper for this Drive, `period` applied, ranked, capped at `limit`. */
  async leaderboardCredits(
    documentId: string,
    period: "week" | "all",
    limit: number
  ): Promise<{ baUserId: string; credits: number }[]> {
    let q = strapi.db.connection
      .select("ba_user_id")
      .count({ credits: "*" })
      .from(CREDIT)
      .where("drive_document_id", documentId)
      .groupBy("ba_user_id")
      .orderBy("credits", "desc")
      .limit(limit)
    if (period === "week") {
      q = q.where(
        "accepted_at",
        ">=",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
    }
    const rows = (await q) as { ba_user_id: string; credits: string | number }[]

    return rows.map((r) => ({
      baUserId: r.ba_user_id,
      credits: Number(r.credits),
    }))
  },

  /**
   * `[{ rank, credits, username, displayName, avatarUrl }]` for this
   * Drive's helpers, `period` "week" (last 7 days) or "all", capped at 20.
   * A private profile, or one with `publicPrefs.showActivity === false`
   * (`isActivityPublic`), is anonymised: `username: null, displayName: "A
   * contributor", avatarUrl: null` — never a `baUserId`.
   */
  async leaderboard(
    documentId: string,
    period: "week" | "all",
    limit: number
  ): Promise<
    {
      rank: number
      credits: number
      username: string | null
      displayName: string | null
      avatarUrl: string | null
    }[]
  > {
    const take = Math.min(
      Math.max(1, Math.trunc(limit) || LEADERBOARD_MAX),
      LEADERBOARD_MAX
    )
    const rows = (await (this as any).leaderboardCredits(
      documentId,
      period,
      take
    )) as { baUserId: string; credits: number }[]
    if (rows.length === 0) return []

    const baUserIds = rows.map((r) => r.baUserId)
    const profiles = (await strapi
      .documents("api::user-profile.user-profile")
      .findMany({
        filters: { baUserId: { $in: baUserIds } },
        fields: [
          "baUserId",
          "username",
          "firstName",
          "lastName",
          "profileVisibility",
          "publicPrefs",
        ],
        populate: { avatar: true },
        limit: baUserIds.length,
      })) as {
      baUserId: string
      username?: string | null
      firstName?: string | null
      lastName?: string | null
      profileVisibility?: string
      publicPrefs?: { showActivity?: boolean } | null
      avatar?: { url?: string | null } | null
    }[]
    const profileMap = new Map(profiles.map((p) => [p.baUserId, p]))

    return rows.map((row, i) => {
      const profile = profileMap.get(row.baUserId)
      const isPublic = !!profile && isActivityPublic(profile)
      if (!isPublic) {
        return {
          rank: i + 1,
          credits: row.credits,
          username: null,
          displayName: "A contributor",
          avatarUrl: null,
        }
      }
      const name = [profile?.firstName, profile?.lastName]
        .filter((v): v is string => !!v)
        .join(" ")
        .trim()

      return {
        rank: i + 1,
        credits: row.credits,
        username: profile?.username ?? null,
        displayName: name || profile?.username || "A contributor",
        avatarUrl: profile?.avatar?.url ?? null,
      }
    })
  },
}))
