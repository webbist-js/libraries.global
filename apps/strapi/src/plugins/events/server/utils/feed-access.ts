const LIBRARY_AFFILIATION_UID = "api::library-affiliation.library-affiliation"
const CLAIMANTS_MAX = 100
/**
 * Mirrors `NON_CLAIM_AFFILIATION_ROLES` in `apps/strapi/src/utils/affiliations.ts`
 * (not imported here to keep this plugin's bundle independent of it): a
 * `proposer` row records who suggested a new library and claims nothing.
 */
const NON_CLAIM_AFFILIATION_ROLES = ["proposer"] as const

/**
 * The libraries a Better Auth user holds a Library Claim on, re-read on
 * every feed request from their affiliations (the same rule the submission
 * policy uses: proposer affiliations don't count).
 */
export async function claimedLibraryIds(
  strapi: any,
  baUserId: string
): Promise<Set<string>> {
  const { caps } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(baUserId)
  if (!caps?.set?.has?.("events.feed")) return new Set()

  return new Set(caps.claimedLibraryIds as Iterable<string>)
}

/**
 * Emails every other claimant of these libraries; best effort, never
 * throws, and a value or hint is never included. Silent without an email
 * provider configured, or when nobody else is claimed on these libraries.
 */
export async function notifyOtherClaimants(
  strapi: any,
  libraryDocumentIds: string[],
  exceptBaUserId: string | null,
  message: { subject: string; text: string }
): Promise<void> {
  try {
    if (libraryDocumentIds.length === 0) return
    const affiliations = (await strapi
      .documents(LIBRARY_AFFILIATION_UID)
      .findMany({
        filters: {
          library: { documentId: { $in: libraryDocumentIds } },
          $or: [
            { role: { $null: true } },
            { role: { $notIn: [...NON_CLAIM_AFFILIATION_ROLES] } },
          ],
        },
        fields: ["baUserId"],
        limit: CLAIMANTS_MAX,
      })) as { baUserId: string }[]
    const ids = [...new Set(affiliations.map((a) => a.baUserId))].filter(
      (id) => id !== exceptBaUserId
    )
    for (const baUserId of ids) {
      await strapi.service("api::notification.notification").enqueue({
        baUserId,
        kind: "feed_update",
        eventKey: `feed:${libraryDocumentIds.slice().sort().join(",")}:${message.subject}:${baUserId}:${Math.floor(Date.now() / 60000)}`,
        title: message.subject,
        body: message.text,
        href: "/staff",
        emailPreference: "transactional",
      })
    }
  } catch (err) {
    strapi.log.warn("[events] claimant notification failed", err)
  }
}
