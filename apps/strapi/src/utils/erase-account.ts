import { createHash, randomUUID } from "node:crypto"

import { purgeErasedMedia, queueErasedMedia } from "./erased-media"

const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const OPTION_VOTE = "plugin::content-moderation.option-vote"
const AFFILIATION = "api::library-affiliation.library-affiliation"
const SAVED_EVENT = "api::saved-event.saved-event"
const ENTITLEMENT_GRANT = "api::entitlement-grant.entitlement-grant"
const PRO_VERIFICATION = "api::pro-verification.pro-verification"
const ROLE_GRANT = "api::role-grant.role-grant"
const DRIVE_HOLD = "api::drive-hold.drive-hold"
const SUBSCRIBER = "api::subscriber.subscriber"
const POINT_EVENT = "plugin::rewards.point-event"
const BADGE_AWARD = "plugin::rewards.badge-award"
const SNAPSHOT = "plugin::rewards.leaderboard-snapshot"
const UP_USER = "plugin::users-permissions.user"
const CREDENTIAL = "plugin::events.event-credential"
const CREDENTIAL_EVENT = "plugin::events.credential-event"

/** Submissions that never became public: their content goes with the account. */
const UNFINISHED_STATUSES = ["draft", "pending", "needs_info", "rejected"]

type SnapshotEntry = { baUserId?: string; username?: string | null }

type UnfinishedSubmission = {
  id: number
  documentId: string
  submissionType?: string
  fields?: unknown
  draftData?: unknown
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
  const profileFileIds: number[] = []

  await strapi.db.transaction(async () => {
    await strapi.db
      .query("api::paid-membership.paid-membership")
      .deleteMany({ where: { baUserId } })
    await strapi.db.query("api::notification.notification").deleteMany({
      where: email
        ? {
            $or: [{ baUserId }, { recipientEmail: email.trim().toLowerCase() }],
          }
        : { baUserId },
    })
    const identity = createHash("sha256").update(baUserId).digest("hex")
    await strapi.db
      .query("api::internal-notification.internal-notification")
      .deleteMany({
        where: {
          $or: [
            { actorId: baUserId },
            { eventKey: `account:${identity}` },
            { eventKey: { $startsWith: `login:${identity}:` } },
            { eventKey: { $startsWith: `active:${identity}:` } },
          ],
        },
      })
    await strapi.plugin("mobile-libraries")?.service("live")?.eraseFor(baUserId)
    await strapi
      .plugin("discussions")
      ?.service("discussion")
      ?.eraseActor?.(`ba:${baUserId}`)
    await strapi.db.query("api::library-notice.library-notice").updateMany({
      where: { createdByBaUserId: baUserId },
      data: { createdByBaUserId: null },
    })
    await strapi.db.query("api::library-notice.library-notice").updateMany({
      where: { endedByBaUserId: baUserId },
      data: { endedByBaUserId: null },
    })
    await strapi
      .plugin("access")
      ?.service("networks")
      ?.prepareErasure?.(baUserId, erasedId)
    await eraseNetworkIdentity(strapi, baUserId, erasedId)
    // Team seats: invites by email go, active rows are anonymised.
    await strapi
      .plugin("access")
      ?.service("teams")
      ?.eraseFor(baUserId, email ?? null)
    await strapi.db.query("plugin::library-staff.staff-audit").updateMany({
      where: { actor: baUserId },
      data: { actor: null, detail: null },
    })
    await strapi.db.query("plugin::library-staff.staff-audit").updateMany({
      where: { subject: baUserId },
      data: { subject: null, detail: null },
    })
    const [profile] = (await strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: baUserId } },
      populate: { avatar: true, coverImage: true },
      limit: 1,
    })) as {
      documentId: string
      id?: number
      contributorNumber?: number | null
      avatar?: { id: number } | null
      coverImage?: { id: number } | null
    }[]

    if (profile) {
      // Captured before the update nulls it on the record.
      if (profile.avatar) profileFileIds.push(profile.avatar.id)
      if (profile.coverImage) profileFileIds.push(profile.coverImage.id)
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
          coverImage: null,
          profileBackground: "violet",
          profileVisibility: "private",
          isVerifiedLibrarian: false,
          contributorRole: "reader",
          languages: [],
          interests: [],
          notifPrefs: null,
          dismissedPrompts: null,
          publicPrefs: null,
          followedLibraries: { set: [] },
          followedDrives: { set: [] },
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
    await queueErasedMedia(strapi, baUserId, erasedId, profileFileIds)
    if (unfinished.length > 0) {
      await strapi.db.query(SUBMISSION).updateMany({
        where: {
          submittedByUserId: baUserId,
          status: { $in: UNFINISHED_STATUSES },
        },
        data: { fields: null, draftData: null, note: null, editSummary: null },
      })
    }

    // These types all have draftAndPublish: false, so bulk db.query writes are
    // consistent with the Document Service.
    await strapi.db.query(SUBMISSION).updateMany({
      where: { submittedByUserId: baUserId },
      data: {
        evidenceType: null,
        evidenceUrl: null,
        note: null,
        draftData: null,
        submittedByEmail: "deleted@invalid",
        submittedByName: null,
        submittedByUserId: erasedId,
      },
    })
    // Public facts and references remain; the change history forgets account identity.
    for (const uid of [
      "api::library-change.library-change",
      "api::article-change.article-change",
    ]) {
      await strapi.db.query(uid).updateMany({
        where: { actorId: `ba:${baUserId}` },
        data: { actorId: null, actorName: null },
      })
      await strapi.db.query(uid).updateMany({
        where: { reviewerId: { $in: [baUserId, `ba:${baUserId}`] } },
        data: { reviewerId: null },
      })
    }
    await strapi.db
      .query("plugin::content-moderation.review-event")
      .updateMany({
        where: { reviewerId: { $in: [baUserId, `ba:${baUserId}`] } },
        data: { reviewerId: null },
      })
    for (const field of ["suggestedBy", "decidedBy", "publicationReviewedBy"]) {
      await strapi.db
        .query("plugin::content-moderation.option-suggestion")
        .updateMany({
          where: { [field]: { $in: [baUserId, `ba:${baUserId}`] } },
          data: { [field]: null },
        })
    }
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
      "plugin::access.network-affiliation",
      "plugin::access.library-authority-grant",
      "plugin::content-moderation.upload-reservation",
      SAVED_EVENT,
      OPTION_VOTE,
      ENTITLEMENT_GRANT,
      PRO_VERIFICATION,
      ROLE_GRANT,
      DRIVE_HOLD,
    ]) {
      await strapi.db.query(uid).deleteMany({ where: { baUserId } })
    }

    // Event Feeds belong to the library: keep approved ones, forget who
    // connected them, and drop anything still waiting on this person.
    const actor = `ba:${baUserId}`
    await strapi.db.query(CREDENTIAL).deleteMany({
      where: { connectedBy: actor, status: { $in: ["pending", "draft"] } },
    })
    const theirOpen = unfinished
      .filter((s) => s.submissionType === "event_feed")
      .map((s) => s.documentId)
    if (theirOpen.length)
      await strapi.db.query(CREDENTIAL).updateMany({
        where: { pendingSubmissionDocumentId: { $in: theirOpen } },
        data: {
          pendingCredentialsEncrypted: null,
          pendingHints: null,
          pendingTestedAt: null,
          pendingTestResult: null,
          pendingSubmissionDocumentId: null,
        },
      })
    await strapi.db.query(CREDENTIAL).updateMany({
      where: { connectedBy: actor },
      data: { connectedBy: null },
    })
    await strapi.db.query(CREDENTIAL_EVENT).updateMany({
      where: { actor },
      data: { actor: "ba:erased" },
    })

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

  // Storage writes happen only after erasure commits. The anonymous ownership
  // ledger remains available to the retention job if storage removal fails.
  await purgeErasedMedia(strapi, erasedId)
}

async function eraseNetworkIdentity(
  strapi: Parameters<typeof eraseAccount>[0],
  userId: string,
  erasedId: string
) {
  await strapi.db.query("plugin::access.network-mandate").updateMany({
    where: { baUserId: userId },
    data: { baUserId: erasedId, revocationReason: "Account deleted" },
  })
  await strapi.db.query("plugin::access.network-mandate").updateMany({
    where: { reviewedBy: `ba:${userId}` },
    data: { reviewedBy: null },
  })
  await strapi.db.query("plugin::access.network-mandate-event").updateMany({
    where: { actor: { $in: [userId, `ba:${userId}`] } },
    data: { actor: erasedId, reason: null },
  })
  await strapi.db.query("plugin::access.widget-audit").updateMany({
    where: { actor: userId },
    data: { actor: erasedId, details: null },
  })
  await strapi.db.query("plugin::access.widget-release").updateMany({
    where: { publisherId: userId },
    data: { publisherId: erasedId },
  })
  await strapi.db.query(SUBMISSION).updateMany({
    where: { submissionType: "network_claim", submittedByUserId: userId },
    data: { fields: null, draftData: null },
  })
}
