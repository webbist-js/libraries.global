/** The live feed behind an event_feed submission, for the review panel. */
export async function feedReview(strapi: any, s: any) {
  const f = (s.fields ?? {}) as Record<string, any>
  const credentialDocumentId = String(f.credentialDocumentId ?? "")
  const feed = credentialDocumentId
    ? await strapi.documents("plugin::events.event-credential").findOne({
        documentId: credentialDocumentId,
        fields: [
          "status",
          "hints",
          "pendingHints",
          "lastTestedAt",
          "lastTestResult",
          "pendingTestedAt",
          "pendingTestResult",
        ],
      })
    : null
  const library = s.targetDocumentId
    ? await strapi.documents("api::library.library").findOne({
        documentId: s.targetDocumentId,
        fields: ["documentId", "name", "slug"],
      })
    : null
  const { caps } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(s.submittedByUserId)
  const replace = f.kind === "replace"
  const latest = replace
    ? feed?.pendingTestResult && {
        result: feed.pendingTestResult,
        testedAt: feed.pendingTestedAt,
      }
    : feed?.lastTestResult && {
        result: feed.lastTestResult,
        testedAt: feed.lastTestedAt,
      }

  return {
    credentialDocumentId,
    exists: !!feed,
    status: feed?.status ?? null,
    kind: replace ? "replace" : "connect",
    provider: String(f.provider ?? ""),
    library: library
      ? {
          documentId: library.documentId,
          name: library.name,
          slug: library.slug ?? null,
        }
      : null,
    currentHints: replace ? (feed?.hints ?? f.previousHints ?? {}) : {},
    newHints: replace
      ? (feed?.pendingHints ?? f.hints ?? {})
      : (feed?.hints ?? f.hints ?? {}),
    submittedTest: f.test?.result
      ? { result: f.test.result, testedAt: f.test.testedAt }
      : null,
    latestTest: latest || null,
    submitterHoldsClaim:
      !!s.targetDocumentId && caps.claimedLibraryIds.has(s.targetDocumentId),
  }
}
