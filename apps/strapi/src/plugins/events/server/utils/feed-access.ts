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
