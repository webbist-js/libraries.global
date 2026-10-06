import { testFeed as realTestFeed } from "@repo/event-providers"
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_BLOCKING,
  FEED_TEST_COOLDOWN_MS,
  feedHints,
  type FeedTestCode,
  MAX_FEEDS_PER_LIBRARY,
  MAX_OPEN_FEED_SUBMISSIONS,
  validateFeedValues,
} from "@repo/shared-data"

import { CREDENTIAL_PUBLIC_FIELDS, CREDENTIAL_UID } from "./credentials"
import { sealValues } from "../utils/credential-crypto"
import { recordCredentialEvent } from "../utils/credential-events"
import { claimedLibraryIds } from "../utils/feed-access"

const SUBMISSION_UID = "plugin::content-moderation.submission"
const LIBRARY_UID = "api::library.library"
const EVENT_UID = "plugin::events.event"
const OPEN = ["pending", "needs_info"]

export type FeedUser = { id: string; email: string | null; name: string | null }
export type FeedError = {
  error: {
    status: number
    name: string
    message: string
    field?: string
    result?: FeedTestCode
  }
}
const fail = (
  status: number,
  name: string,
  message: string,
  extra: Record<string, unknown> = {}
): FeedError => ({
  error: { status, name, message, ...extra },
})
const NOT_FOUND = fail(404, "not_found", "Feed not found.")
const actorOf = (user: FeedUser) => `ba:${user.id}`
const libraryIdsOf = (c: any): string[] =>
  ((c?.libraries as any[]) ?? []).map((l) => l?.documentId).filter(Boolean)

type Deps = {
  strapi: any
  testFeed?: (
    provider: string,
    values: Record<string, string>
  ) => Promise<{ result: FeedTestCode; detail?: string }>
}

export default ({ strapi, testFeed = realTestFeed }: Deps) => {
  const creds = () => strapi.documents(CREDENTIAL_UID)
  const policy = () =>
    strapi.plugin("content-moderation").service("submission-policy")
  const submissions = () =>
    strapi.plugin("content-moderation").service("submission")

  /** A feed the user may manage, or a FeedError (404 hides others' feeds). */
  async function manageable(
    user: FeedUser,
    documentId: string
  ): Promise<{ feed: any; claims: Set<string> } | FeedError> {
    const feed = await creds().findOne({
      documentId,
      fields: [...CREDENTIAL_PUBLIC_FIELDS, "id"],
      populate: { libraries: { fields: ["documentId", "name"] } },
    })
    if (!feed) return NOT_FOUND
    const claims = await claimedLibraryIds(strapi, user.id)
    if (!libraryIdsOf(feed).some((id) => claims.has(id))) return NOT_FOUND
    if (feed.scope === "group")
      return fail(403, "group_feed", "Libraries Global manages this feed.")

    return { feed, claims }
  }

  async function checkValues(provider: unknown, values: unknown) {
    const r = validateFeedValues(provider, values)

    return r.ok ? r : fail(400, "invalid_values", r.error, { field: r.field })
  }

  async function runTest(
    provider: string,
    values: Record<string, string>
  ): Promise<FeedTestCode> {
    try {
      return (await testFeed(provider, values)).result
    } catch {
      return "provider_error"
    }
  }

  async function openFeedSubmissions(baUserId: string): Promise<number> {
    return strapi.documents(SUBMISSION_UID).count({
      filters: {
        submittedByUserId: baUserId,
        submissionType: "event_feed",
        status: { $in: OPEN },
      },
    })
  }

  /**
   * Creates the Submission with `notify: false`: it's called from inside
   * this service's own `strapi.db.transaction`, and `create`'s scheduled
   * alert (queued with `setImmediate`) could otherwise run before that
   * transaction commits, or after it rolls back. The caller schedules it
   * itself, with `notifyPending`, once the transaction has resolved.
   */
  async function createSubmission(
    user: FeedUser,
    libraryDocumentId: string,
    fields: Record<string, unknown>
  ) {
    return submissions().create({
      submissionType: "event_feed",
      targetEntityType: "library",
      targetDocumentId: libraryDocumentId,
      fields,
      submittedByUserId: user.id,
      submittedByEmail: user.email ?? "",
      submittedByName: user.name ?? undefined,
      notify: false,
    })
  }

  return {
    async list(user: FeedUser) {
      const claims = [...(await claimedLibraryIds(strapi, user.id))]
      if (claims.length === 0) return { libraries: [] }
      const libraries = (await strapi.documents(LIBRARY_UID).findMany({
        filters: { documentId: { $in: claims } },
        fields: ["documentId", "name", "slug"],
        limit: claims.length,
      })) as any[]
      const feeds = (await creds().findMany({
        filters: { libraries: { documentId: { $in: claims } } },
        fields: [...CREDENTIAL_PUBLIC_FIELDS, "id"],
        populate: { libraries: { fields: ["documentId"] } },
        limit: claims.length * MAX_FEEDS_PER_LIBRARY + 50,
      })) as any[]
      const reviewIds = feeds
        .map((f) => f.pendingSubmissionDocumentId)
        .filter(Boolean)
      const reviews = reviewIds.length
        ? ((await strapi.documents(SUBMISSION_UID).findMany({
            filters: { documentId: { $in: reviewIds } },
            fields: ["documentId", "status", "reviewNote", "fields"],
            limit: reviewIds.length,
          })) as any[])
        : []
      const reviewOf = new Map(reviews.map((r) => [r.documentId, r]))
      const now = new Date().toISOString()
      const upcoming = async (id: number) =>
        strapi
          .documents(EVENT_UID)
          .count({ filters: { credentialId: id, startTime: { $gte: now } } })

      return {
        libraries: await Promise.all(
          libraries.map(async (library) => ({
            library: {
              documentId: library.documentId,
              name: library.name,
              slug: library.slug ?? null,
            },
            feeds: await Promise.all(
              feeds
                .filter((f) => libraryIdsOf(f).includes(library.documentId))
                .map(async (f) => {
                  const r = f.pendingSubmissionDocumentId
                    ? reviewOf.get(f.pendingSubmissionDocumentId)
                    : null

                  return {
                    documentId: f.documentId,
                    provider: f.provider,
                    label: f.label,
                    scope: f.scope,
                    status: f.status,
                    pausedReason: f.pausedReason ?? null,
                    managedBy: f.scope === "group" ? "admin_group" : "library",
                    hints: f.hints ?? {},
                    pendingHints: f.pendingHints ?? null,
                    review: r
                      ? {
                          submissionDocumentId: r.documentId,
                          kind: r.fields?.kind ?? "connect",
                          status: r.status,
                          note: r.reviewNote ?? null,
                        }
                      : null,
                    lastTestedAt: f.lastTestedAt ?? null,
                    lastTestResult: f.lastTestResult ?? null,
                    lastSyncAt: f.lastSyncAt ?? null,
                    lastSyncStatus: f.lastSyncStatus ?? null,
                    lastErrorCode: f.lastErrorCode ?? null,
                    upcomingEvents: await upcoming(f.id),
                  }
                })
            ),
          }))
        ),
      }
    },

    async testValues(
      user: FeedUser,
      input: { libraryDocumentId: string; provider: string; values: unknown }
    ) {
      const claims = await claimedLibraryIds(strapi, user.id)
      if (!claims.has(input.libraryDocumentId)) return NOT_FOUND
      const checked = await checkValues(input.provider, input.values)
      if ("error" in checked) return checked

      return { result: await runTest(input.provider, checked.values) }
    },

    async connect(
      user: FeedUser,
      input: { libraryDocumentId: string; provider: string; values: unknown }
    ) {
      const claims = await claimedLibraryIds(strapi, user.id)
      if (!claims.has(input.libraryDocumentId)) return NOT_FOUND
      const checked = await checkValues(input.provider, input.values)
      if ("error" in checked) return checked
      const provider = input.provider as EventProviderKey

      const verdict = await policy().check({
        baUserId: user.id,
        submissionType: "event_feed",
        targetEntityType: "library",
        targetDocumentId: input.libraryDocumentId,
      })
      if (!verdict.ok)
        return fail(
          verdict.status ?? 403,
          "refused",
          verdict.message ?? "You can't connect a feed here."
        )
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )
      const onLibrary = await creds().count({
        filters: {
          libraries: { documentId: { $in: [input.libraryDocumentId] } },
        },
      })
      if (onLibrary >= MAX_FEEDS_PER_LIBRARY)
        return fail(
          409,
          "too_many_feeds",
          `A library can have at most ${MAX_FEEDS_PER_LIBRARY} feeds.`
        )

      // Outside the transaction: a provider can take 15 seconds to answer.
      const result = await runTest(provider, checked.values)
      if (FEED_TEST_BLOCKING.has(result))
        return fail(422, "test_failed", "The connection test failed.", {
          result,
        })
      const testedAt = new Date().toISOString()
      const hints = feedHints(provider, checked.values)
      const library = await strapi
        .documents(LIBRARY_UID)
        .findOne({ documentId: input.libraryDocumentId, fields: ["name"] })

      const outcome = await strapi.db.transaction(async () => {
        const created = await creds().create({
          data: {
            provider,
            label: `${String(library?.name ?? "Library").slice(0, 150)} · ${EVENT_PROVIDERS[provider].label}`,
            scope: "library",
            status: "pending",
            source: "library",
            connectedBy: actorOf(user),
            credentialsEncrypted: "{}",
            hints,
            lastTestedAt: testedAt,
            lastTestResult: result,
            libraries: [{ documentId: input.libraryDocumentId }],
          },
        })
        const documentId = created.documentId as string
        const submission = await createSubmission(
          user,
          input.libraryDocumentId,
          {
            kind: "connect",
            credentialDocumentId: documentId,
            provider,
            hints,
            test: { result, testedAt },
          }
        )
        await creds().update({
          documentId,
          data: {
            credentialsEncrypted: sealValues(
              checked.values,
              documentId,
              "current"
            ),
            pendingSubmissionDocumentId: submission.documentId,
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider,
          libraryDocumentIds: [input.libraryDocumentId],
          action: "connect_submitted",
          actor: actorOf(user),
          submissionDocumentId: submission.documentId,
          resultCode: result,
        })

        return {
          credentialDocumentId: documentId,
          submissionDocumentId: submission.documentId as string,
          result,
          submission,
        }
      })
      submissions().notifyPending(outcome.submission)

      return {
        credentialDocumentId: outcome.credentialDocumentId,
        submissionDocumentId: outcome.submissionDocumentId,
        result: outcome.result,
      }
    },

    async replace(
      user: FeedUser,
      documentId: string,
      input: { values: unknown }
    ) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      const { feed } = access
      if (feed.status === "pending" || feed.status === "draft")
        return fail(
          409,
          "review_pending",
          "This feed is still waiting for review. Withdraw it and connect again."
        )
      if (feed.pendingSubmissionDocumentId)
        return fail(
          409,
          "replacement_pending",
          "New details are already waiting for review."
        )
      const checked = await checkValues(feed.provider, input.values)
      if ("error" in checked) return checked
      const libraryDocumentId = libraryIdsOf(feed).find((id) =>
        access.claims.has(id)
      )!
      const verdict = await policy().check({
        baUserId: user.id,
        submissionType: "event_feed",
        targetEntityType: "library",
        targetDocumentId: libraryDocumentId,
      })
      if (!verdict.ok)
        return fail(
          verdict.status ?? 403,
          "refused",
          verdict.message ?? "You can't replace this feed."
        )
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )

      const result = await runTest(feed.provider, checked.values)
      if (FEED_TEST_BLOCKING.has(result))
        return fail(422, "test_failed", "The connection test failed.", {
          result,
        })
      const testedAt = new Date().toISOString()
      const hints = feedHints(feed.provider, checked.values)

      const outcome = await strapi.db.transaction(async () => {
        const submission = await createSubmission(user, libraryDocumentId, {
          kind: "replace",
          credentialDocumentId: documentId,
          provider: feed.provider,
          hints,
          previousHints: feed.hints ?? {},
          test: { result, testedAt },
        })
        await creds().update({
          documentId,
          data: {
            pendingCredentialsEncrypted: sealValues(
              checked.values,
              documentId,
              "pending"
            ),
            pendingHints: hints,
            pendingTestedAt: testedAt,
            pendingTestResult: result,
            pendingSubmissionDocumentId: submission.documentId,
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: feed.provider,
          libraryDocumentIds: libraryIdsOf(feed),
          action: "replace_submitted",
          actor: actorOf(user),
          submissionDocumentId: submission.documentId,
          resultCode: result,
        })

        return {
          submissionDocumentId: submission.documentId as string,
          result,
          submission,
        }
      })
      submissions().notifyPending(outcome.submission)

      return {
        submissionDocumentId: outcome.submissionDocumentId,
        result: outcome.result,
      }
    },
  }
}

export { FEED_TEST_COOLDOWN_MS }
