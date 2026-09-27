const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const SUBMISSION_UPLOAD = "plugin::content-moderation.submission-upload"
const AFFILIATION = "api::library-affiliation.library-affiliation"
const SAVED_EVENT = "api::saved-event.saved-event"
const POINT_EVENT = "plugin::rewards.point-event"
const BADGE_AWARD = "plugin::rewards.badge-award"
const SNAPSHOT = "plugin::rewards.leaderboard-snapshot"
const UP_USER = "plugin::users-permissions.user"

type SnapshotEntry = { baUserId?: string; username?: string | null }

/**
 * Erase a deleted account's personal data, as the privacy notice promises:
 * the profile is anonymised and emptied (follows, languages, interests,
 * preferences, rewards), the avatar file, saved events, claims and upload
 * ownership are deleted, and submissions, points, badges and leaderboard
 * snapshots are re-keyed so nothing links back to the person.
 * Approved contributions themselves stay in the public record.
 */
export async function eraseAccount(
  strapi: any,
  { baUserId, email }: { baUserId: string; email?: string }
): Promise<void> {
  const erasedId = `deleted-${baUserId}`

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
    const avatar = profile.avatar
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
        quickWins: [],
        quickWinsComputedAt: null,
        interests: [],
        notifPrefs: null,
        publicPrefs: null,
        followedLibraries: { set: [] },
        followedProfiles: { set: [] },
        points: 0,
        pointsThisMonth: 0,
        tier: "Reader",
        streak: 0,
        lastActivityDate: null,
      },
    })

    if (avatar) {
      try {
        await strapi.plugin("upload").service("upload").remove(avatar)
      } catch (err) {
        strapi.log.warn("[erase-account] avatar file not removed:", err)
      }
    }
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
  await strapi.db.query(AFFILIATION).deleteMany({ where: { baUserId } })
  await strapi.db.query(SUBMISSION_UPLOAD).deleteMany({ where: { baUserId } })
  await strapi.db.query(SAVED_EVENT).deleteMany({ where: { baUserId } })

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
    await strapi.db.query(UP_USER).delete({ where: { email } })
  }
}
