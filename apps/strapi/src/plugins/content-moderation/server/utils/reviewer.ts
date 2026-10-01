/**
 * Who decides a Submission. Stored on the submission as `reviewedByUserId`
 * and on Review Events as `reviewerId`, always prefixed by kind so an admin
 * id can never be read as a contributor's: `admin:<admin user id>` or
 * `ba:<Better Auth user id>`.
 */
export type Reviewer = {
  id: string
  kind: "admin" | "contributor"
  email: string | null
  baUserId: string | null
}

const cleanEmail = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null

/** A Strapi admin user (the moderation queue in the admin panel). */
export function adminReviewer(admin: {
  id: number | string
  email?: string | null
}): Reviewer {
  return {
    id: `admin:${admin.id}`,
    kind: "admin",
    email: cleanEmail(admin.email),
    baUserId: null,
  }
}

/** A contributor acting as a Moderator through the site. */
export function contributorReviewer(u: {
  id: string
  email?: string | null
}): Reviewer {
  return {
    id: `ba:${u.id}`,
    kind: "contributor",
    email: cleanEmail(u.email),
    baUserId: u.id,
  }
}

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()

/**
 * No self-review. A contributor is matched by Better Auth id; an admin by
 * email, compared case-insensitively after trimming, so a stray space or
 * capital can't slip past.
 */
export function isSelfReview(
  r: Reviewer,
  s: { submittedByUserId: string; submittedByEmail?: string | null }
): boolean {
  if (r.kind === "contributor")
    return !!r.baUserId && r.baUserId === s.submittedByUserId
  const mine = norm(r.email)

  return !!mine && mine === norm(s.submittedByEmail)
}

const SUBMISSION = "plugin::content-moderation.submission"
const STORE = { type: "plugin", name: "content-moderation" } as const
const PREFIX_KEY = "reviewer-prefix-v1"
const PAGE = 200
const PREFIXED = /^(admin|ba):/

/**
 * One-off: `reviewedByUserId` used to hold a bare admin id. Prefixes every
 * non-empty one that lacks `admin:`/`ba:` with `admin:` (only admins
 * reviewed before contributor Moderators existed). Guarded by a core-store
 * flag; safe to run again, since prefixed ids are left alone.
 */
export async function migrateReviewerPrefix(
  strapi: any
): Promise<{ updated: number }> {
  const store = strapi.store(STORE)
  if (await store.get({ key: PREFIX_KEY })) return { updated: 0 }

  let updated = 0
  for (let start = 0; ; start += PAGE) {
    const rows = (await strapi.documents(SUBMISSION).findMany({
      filters: { reviewedByUserId: { $notNull: true } },
      fields: ["reviewedByUserId"],
      sort: "id:asc",
      start,
      limit: PAGE,
    })) as { documentId: string; reviewedByUserId?: string | null }[]

    for (const row of rows) {
      const id = row.reviewedByUserId
      if (typeof id !== "string" || !id || PREFIXED.test(id)) continue
      await strapi.documents(SUBMISSION).update({
        documentId: row.documentId,
        data: { reviewedByUserId: `admin:${id}` },
      })
      updated += 1
    }
    if (rows.length < PAGE) break
  }

  await store.set({
    key: PREFIX_KEY,
    value: { at: new Date().toISOString(), updated },
  })
  strapi.log.info(
    `[content-moderation] Prefixed ${updated} reviewer ids with admin:`
  )

  return { updated }
}
