import { randomUUID } from "node:crypto"

const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const SUBMISSION_UPLOAD = "plugin::content-moderation.submission-upload"
const OPTION_VOTE = "plugin::content-moderation.option-vote"
const AFFILIATION = "api::library-affiliation.library-affiliation"
const SAVED_EVENT = "api::saved-event.saved-event"
const ENTITLEMENT_GRANT = "api::entitlement-grant.entitlement-grant"
const PRO_VERIFICATION = "api::pro-verification.pro-verification"
const ROLE_GRANT = "api::role-grant.role-grant"
const SUBSCRIBER = "api::subscriber.subscriber"
const POINT_EVENT = "plugin::rewards.point-event"
const BADGE_AWARD = "plugin::rewards.badge-award"
const SNAPSHOT = "plugin::rewards.leaderboard-snapshot"
const UP_USER = "plugin::users-permissions.user"
const UP_FILE = "plugin::upload.file"

/** Submissions that never became public: their content goes with the account. */
const UNFINISHED_STATUSES = ["draft", "pending", "needs_info"]

type SnapshotEntry = { baUserId?: string; username?: string | null }

type UnfinishedSubmission = {
  id: number
  fields?: unknown
  draftData?: unknown
}

/** Every `photoId` a submission's fields or draft carries. */
function photoIdsOf(submission: UnfinishedSubmission): number[] {
  const ids = new Set<number>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return
    const id = Number((value as { photoId?: unknown }).photoId)
    if (Number.isInteger(id) && id > 0) ids.add(id)
    const nested = (value as { fields?: unknown }).fields
    if (nested && typeof nested === "object") visit(nested)
  }
  visit(submission.fields)
  visit(submission.draftData)

  return [...ids]
}

async function removeFile(strapi: any, file: unknown, what: string) {
  try {
    await strapi.plugin("upload").service("upload").remove(file)
  } catch (err) {
    strapi.log.warn(`[erase-account] ${what} not removed:`, err)
  }
}

/**
 * Erase a deleted account's personal data, as the privacy notice promises:
 * the profile is anonymised and emptied (follows, languages, interests,
 * preferences, rewards, earned Pro), the avatar, saved events, claims,
 * votes, plan and role grants, verifications, upload ownership and the newsletter
 * subscription are deleted, unfinished submissions lose their content and
 * photos, and submissions, points, badges and leaderboard snapshots are
 * re-keyed to one random id that cannot be traced back to the person.
 * Approved contributions themselves stay in the public record.
 *
 * Runs in one transaction, so a failure part-way leaves nothing half-erased.
 */
export async function eraseAccount(
  strapi: any,
  { baUserId, email }: { baUserId: string; email?: string }
): Promise<void> {
  const erasedId = `deleted-${randomUUID()}`
  const filesToRemove: unknown[] = []

  await strapi.db.transaction(async () => {
    const [profile] = (await strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: baUserId } },
      populate: { avatar: true },
      limit: 1,
    })) as {
      documentId: string
      id?: number
      contributorNumber?: number | null
      avatar?: { id: number } | null
    }[]

    if (profile) {
      // Captured before the update nulls it on the record.
      if (profile.avatar) filesToRemove.push(profile.avatar)
      await strapi.documents(PROFILE).update({
        documentId: profile.documentId,
        data: {
          baUserId: erasedId,
          username: `deleted-${profile.contributorNumber ?? profile.id}`,
          firstName: "Deleted",
          lastName: "User",
          bio: null,
          pronouns: null,
          affiliation: null,
          affiliationType: null,
          jobTitle: null,
          city: null,
          country: null,
          timezone: null,
          website: null,
          orcid: null,
          mastodon: null,
          linkedin: null,
          avatar: null,
          profileVisibility: "private",
          isVerifiedLibrarian: false,
          contributorRole: "reader",
          languages: [],
          interests: [],
          notifPrefs: null,
          dismissedPrompts: null,
          publicPrefs: null,
          followedLibraries: { set: [] },
          followedProfiles: { set: [] },
          points: 0,
          pointsThisMonth: 0,
          tier: "Reader",
          streak: 0,
          lastActivityDate: null,
          earnedProUntil: null,
        },
      })
    }

    // Unfinished submissions: their content (which may hold contact details
    // or a photo) is dropped before the rows are re-keyed.
    const unfinished = (await strapi.db.query(SUBMISSION).findMany({
      where: {
        submittedByUserId: baUserId,
        status: { $in: UNFINISHED_STATUSES },
      },
    })) as UnfinishedSubmission[]
    const photoIds = new Set(unfinished.flatMap(photoIdsOf))
    for (const id of photoIds) {
      const file = await strapi.db.query(UP_FILE).findOne({ where: { id } })
      if (file) filesToRemove.push(file)
    }
    if (unfinished.length > 0) {
      await strapi.db.query(SUBMISSION).updateMany({
        where: {
          submittedByUserId: baUserId,
          status: { $in: UNFINISHED_STATUSES },
        },
        data: { fields: null, draftData: null, note: null },
      })
    }

    // These types all have draftAndPublish: false, so bulk db.query writes are
    // consistent with the Document Service.
    await strapi.db.query(SUBMISSION).updateMany({
      where: { submittedByUserId: baUserId },
      data: {
        submittedByEmail: "deleted@invalid",
        submittedByName: null,
        submittedByUserId: erasedId,
      },
    })
    await strapi.db.query(POINT_EVENT).updateMany({
      where: { baUserId },
      data: { baUserId: erasedId },
    })
    await strapi.db.query(BADGE_AWARD).updateMany({
      where: { baUserId },
      data: { baUserId: erasedId },
    })
    for (const uid of [
      AFFILIATION,
      SUBMISSION_UPLOAD,
      SAVED_EVENT,
      OPTION_VOTE,
      ENTITLEMENT_GRANT,
      PRO_VERIFICATION,
      ROLE_GRANT,
    ]) {
      await strapi.db.query(uid).deleteMany({ where: { baUserId } })
    }

    const snapshots = (await strapi.db.query(SNAPSHOT).findMany({})) as {
      id: number
      entries?: SnapshotEntry[] | null
    }[]
    for (const snapshot of snapshots) {
      const entries = Array.isArray(snapshot.entries) ? snapshot.entries : []
      if (!entries.some((entry) => entry?.baUserId === baUserId)) continue
      await strapi.db.query(SNAPSHOT).update({
        where: { id: snapshot.id },
        data: {
          entries: entries.map((entry) =>
            entry?.baUserId === baUserId
              ? { ...entry, baUserId: erasedId, username: null }
              : entry
          ),
        },
      })
    }

    if (email) {
      await strapi.db.query(SUBSCRIBER).deleteMany({
        where: { email: { $eqi: email } },
      })
      await strapi.db.query(UP_USER).delete({ where: { email } })
    }
  })

  // Files go after the rows are committed: a failed removal only warns,
  // and a rolled-back erase must not have deleted anything.
  for (const file of filesToRemove) {
    await removeFile(strapi, file, `file ${(file as { id?: number }).id}`)
  }
}
