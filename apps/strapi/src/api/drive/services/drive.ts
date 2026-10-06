/**
 * drive service.
 *
 * `draftAndPublish` is off for `api::drive.drive` (its `schema.json`): the
 * content type's own lifecycle is the `status` attribute
 * (draft/scheduled/open/closed/cancelled), and naming it `status` collides
 * with the Document Service's reserved draft/publish meta-field when
 * `draftAndPublish` is on — Strapi refuses to boot without a warning in that
 * case. With it off, every write is live immediately, so no
 * `documents()` call needs (or accepts) its own `status` option; `toPublic`
 * strips the two board-only fields unconditionally, so a programming
 * mistake in a field list can never leak them.
 */

import {
  DRIVE_MAX_PINNED,
  validateDrive,
  type DriveInput,
} from "@repo/shared-data"
import { factories } from "@strapi/strapi"

const UID = "api::drive.drive"

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

  /** The one drive with this slug, or null. */
  async bySlug(
    slug: string,
    locale = "en"
  ): Promise<Record<string, unknown> | null> {
    const rows = (await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } },
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

    switch (action) {
      case "pin": {
        if (settled) {
          return {
            errors: ["A closed drive can't be pinned."],
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
            errors: ["A closed drive can't be featured."],
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
            errors: ["This drive has already closed."],
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
}))
