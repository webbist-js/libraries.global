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
import { ApplyRefusedError } from "../../../content-moderation/server/utils/publish-guard"
import { systemReviewer } from "../../../content-moderation/server/utils/reviewer"
import { openValues, sealValues } from "../utils/credential-crypto"
import { recordCredentialEvent } from "../utils/credential-events"
import { claimedLibraryIds, notifyOtherClaimants } from "../utils/feed-access"

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
/** A fresh object per call: callers never share one `FeedError` reference. */
const feedNotFound = (): FeedError => fail(404, "not_found", "Feed not found.")
const libraryNotFound = (): FeedError =>
  fail(404, "not_found", "Library not found.")
const actorOf = (user: FeedUser) => `ba:${user.id}`
const libraryIdsOf = (c: any): string[] =>
  ((c?.libraries as any[]) ?? []).map((l) => l?.documentId).filter(Boolean)

/**
 * Thrown from inside `strapi.db.transaction` to abort it (the fake and real
 * transaction both roll back on any throw) without the caller mistaking it
 * for an unexpected failure: `runTransaction` catches exactly this and turns
 * it back into the `FeedError` it carries. Anything else thrown propagates.
 */
class FeedAbort extends Error {
  constructor(public readonly feedError: FeedError) {
    super(feedError.error.name)
  }
}

/** Runs `cb` in a transaction, turning an inner `FeedAbort` into its `FeedError`. */
async function runTransaction<T>(
  strapi: any,
  cb: () => Promise<T>
): Promise<T | FeedError> {
  try {
    return await strapi.db.transaction(cb)
  } catch (err) {
    if (err instanceof FeedAbort) return err.feedError
    throw err
  }
}

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
  const credentialsService = () =>
    strapi.plugin("events").service("credentials")

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
    if (!feed) return feedNotFound()
    const claims = await claimedLibraryIds(strapi, user.id)
    if (!libraryIdsOf(feed).some((id) => claims.has(id))) return feedNotFound()
    if (feed.scope === "group")
      return fail(403, "group_feed", "Libraries Global manages this feed.")

    return { feed, claims }
  }

  /** Nothing here awaits: `validateFeedValues` is synchronous. */
  function checkValues(provider: unknown, values: unknown) {
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

  async function feedsOnLibrary(libraryDocumentId: string): Promise<number> {
    return creds().count({
      filters: { libraries: { documentId: { $in: [libraryDocumentId] } } },
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

  /**
   * The shared part of `connect` and `completeDraft`: opens the review for
   * a credential that already exists (pending from `connect`, or a draft
   * from `feed-oauth.exchangeEventbrite` finishing its organisation choice
   * from `completeDraft`). Called from inside the caller's own
   * `strapi.db.transaction`. Re-checks the open-submission quota
   * authoritatively (a concurrent submission could have used it up while
   * the provider test, which runs outside any transaction, was in flight),
   * then seals the value under the current slot, stores its hints, moves
   * the credential to `pending` and records the Submission.
   */
  async function openConnectReview(
    user: FeedUser,
    documentId: string,
    libraryDocumentId: string,
    provider: EventProviderKey,
    values: Record<string, string>,
    result: FeedTestCode,
    testedAt: string
  ) {
    if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
      throw new FeedAbort(
        fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )
      )

    const hints = feedHints(provider, values)
    const submission = await createSubmission(user, libraryDocumentId, {
      kind: "connect",
      credentialDocumentId: documentId,
      provider,
      hints,
      test: { result, testedAt },
    })
    await creds().update({
      documentId,
      data: {
        status: "pending",
        credentialsEncrypted: sealValues(values, documentId, "current"),
        hints,
        lastTestedAt: testedAt,
        lastTestResult: result,
        pendingSubmissionDocumentId: submission.documentId,
      },
    })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: documentId,
      provider,
      libraryDocumentIds: [libraryDocumentId],
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
      if (!claims.has(input.libraryDocumentId)) return libraryNotFound()
      const checked = checkValues(input.provider, input.values)
      if ("error" in checked) return checked

      return { result: await runTest(input.provider, checked.values) }
    },

    async connect(
      user: FeedUser,
      input: { libraryDocumentId: string; provider: string; values: unknown }
    ) {
      const claims = await claimedLibraryIds(strapi, user.id)
      if (!claims.has(input.libraryDocumentId)) return libraryNotFound()
      const checked = checkValues(input.provider, input.values)
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
      // Fast pre-checks, so a quota that's already exceeded never pays for
      // the provider test below (it can take ~15 seconds). Re-checked,
      // authoritatively, inside the transaction, because a concurrent
      // connect can still land in between.
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )
      if (
        (await feedsOnLibrary(input.libraryDocumentId)) >= MAX_FEEDS_PER_LIBRARY
      )
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

      const outcome = await runTransaction(strapi, async () => {
        // Authoritative re-check: a concurrent connect could have used up
        // this quota while the provider test above was in flight. The
        // open-submission quota is re-checked inside `openConnectReview`.
        if (
          (await feedsOnLibrary(input.libraryDocumentId)) >=
          MAX_FEEDS_PER_LIBRARY
        )
          throw new FeedAbort(
            fail(
              409,
              "too_many_feeds",
              `A library can have at most ${MAX_FEEDS_PER_LIBRARY} feeds.`
            )
          )

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

        return openConnectReview(
          user,
          created.documentId as string,
          input.libraryDocumentId,
          provider,
          checked.values,
          result,
          testedAt
        )
      })
      if ("error" in outcome) return outcome
      submissions().notifyPending(outcome.submission)

      return {
        credentialDocumentId: outcome.credentialDocumentId,
        submissionDocumentId: outcome.submissionDocumentId,
        result: outcome.result,
      }
    },

    /**
     * Finishes a draft from `feed-oauth.exchangeEventbrite` once the
     * librarian has chosen (or it auto-chose, for one organisation) an
     * Eventbrite organisation: validates the choice against the draft's
     * `hints.organizations`, runs the same policy, quota and test checks as
     * `connect`, then opens its review through the shared
     * `openConnectReview`.
     */
    async completeDraft(
      user: FeedUser,
      documentId: string,
      organizationId: string
    ) {
      const draft = await creds().findOne({
        documentId,
        fields: [
          ...CREDENTIAL_PUBLIC_FIELDS,
          "id",
          "connectedBy",
          "credentialsEncrypted",
        ],
        populate: { libraries: { fields: ["documentId"] } },
      })
      if (
        !draft ||
        draft.status !== "draft" ||
        draft.connectedBy !== actorOf(user)
      )
        return feedNotFound()
      const claims = await claimedLibraryIds(strapi, user.id)
      const libraryDocumentId = libraryIdsOf(draft).find((id) => claims.has(id))
      if (!libraryDocumentId) return feedNotFound()

      const organizations = (draft.hints?.organizations ?? []) as {
        id: string
        name: string
      }[]
      if (!organizations.some((o) => o.id === organizationId))
        return fail(
          400,
          "invalid_organization",
          "Choose one of the listed organisations."
        )

      const current = openValues(
        draft.credentialsEncrypted,
        documentId,
        "current"
      )
      const checked = checkValues("eventbrite", {
        ...current,
        organizationId,
      })
      if ("error" in checked) return checked

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
          verdict.message ?? "You can't connect a feed here."
        )
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )

      // Outside the transaction: a provider can take 15 seconds to answer.
      const result = await runTest("eventbrite", checked.values)
      if (FEED_TEST_BLOCKING.has(result))
        return fail(422, "test_failed", "The connection test failed.", {
          result,
        })
      const testedAt = new Date().toISOString()

      const outcome = await runTransaction(strapi, async () => {
        // Authoritative re-check: the draft could have been withdrawn, or
        // already completed by a concurrent call, while the provider test
        // above was in flight.
        const fresh = await creds().findOne({
          documentId,
          fields: ["documentId", "status", "connectedBy"],
        })
        if (
          !fresh ||
          fresh.status !== "draft" ||
          fresh.connectedBy !== actorOf(user)
        )
          throw new FeedAbort(feedNotFound())

        return openConnectReview(
          user,
          documentId,
          libraryDocumentId,
          "eventbrite",
          checked.values,
          result,
          testedAt
        )
      })
      if ("error" in outcome) return outcome
      submissions().notifyPending(outcome.submission)

      return {
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
      const checked = checkValues(feed.provider, input.values)
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

      const outcome = await runTransaction(strapi, async () => {
        // Authoritative re-check, as the first step inside the transaction:
        // the provider test above can take ~15 seconds, during which the
        // feed may have been disconnected, or another replace (or the
        // first review) may already have claimed the pending slot.
        const fresh = await creds().findOne({
          documentId,
          fields: ["documentId", "status", "pendingSubmissionDocumentId"],
        })
        if (!fresh) throw new FeedAbort(feedNotFound())
        if (fresh.status === "pending" || fresh.status === "draft")
          throw new FeedAbort(
            fail(
              409,
              "review_pending",
              "This feed is still waiting for review. Withdraw it and connect again."
            )
          )
        if (fresh.pendingSubmissionDocumentId)
          throw new FeedAbort(
            fail(
              409,
              "replacement_pending",
              "New details are already waiting for review."
            )
          )

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
      if ("error" in outcome) return outcome
      submissions().notifyPending(outcome.submission)

      return {
        submissionDocumentId: outcome.submissionDocumentId,
        result: outcome.result,
      }
    },

    async testCurrent(user: FeedUser, documentId: string) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      const last = access.feed.lastTestedAt
        ? Date.parse(access.feed.lastTestedAt)
        : 0
      if (Date.now() - last < FEED_TEST_COOLDOWN_MS)
        return fail(429, "too_soon", "Wait half a minute between tests.")
      const r = await credentialsService().test(
        documentId,
        "current",
        actorOf(user)
      )

      return r ?? feedNotFound()
    },

    async pause(user: FeedUser, documentId: string) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      if (access.feed.status !== "active")
        return fail(409, "not_active", "Only an active feed can be paused.")
      await strapi.db.transaction(async () => {
        await creds().update({
          documentId,
          data: { status: "paused", pausedReason: "library" },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: access.feed.provider,
          libraryDocumentIds: libraryIdsOf(access.feed),
          action: "paused",
          actor: actorOf(user),
        })
      })
      await credentialsService().syncLibraryFeedFlags(libraryIdsOf(access.feed))

      return { status: "paused" as const }
    },

    async resume(user: FeedUser, documentId: string) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      if (access.feed.status !== "paused")
        return fail(409, "not_paused", "Only a paused feed can be resumed.")
      await strapi.db.transaction(async () => {
        await creds().update({
          documentId,
          data: {
            status: "active",
            pausedReason: null,
            consecutiveFailures: 0,
            autoPauseNotifiedAt: null,
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: access.feed.provider,
          libraryDocumentIds: libraryIdsOf(access.feed),
          action: "resumed",
          actor: actorOf(user),
        })
      })
      await credentialsService().syncLibraryFeedFlags(libraryIdsOf(access.feed))
      await credentialsService().queueSync(documentId, actorOf(user))

      return { status: "active" as const }
    },

    async withdrawPending(user: FeedUser, documentId: string) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      const { feed } = access
      if (!feed.pendingSubmissionDocumentId || feed.status === "pending")
        return fail(
          409,
          "nothing_pending",
          "There are no new details waiting for review."
        )
      await submissions().updateStatus(
        feed.pendingSubmissionDocumentId,
        "rejected",
        systemReviewer(),
        "Withdrawn by the library"
      )
      // The rejection's apply (Task 9) clears the slot; clear it here too in
      // case the submission had already been decided elsewhere.
      await creds().update({
        documentId,
        data: {
          pendingCredentialsEncrypted: null,
          pendingHints: null,
          pendingTestedAt: null,
          pendingTestResult: null,
          pendingSubmissionDocumentId: null,
        },
      })
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: feed.provider,
        libraryDocumentIds: libraryIdsOf(feed),
        action: "withdrawn",
        actor: actorOf(user),
        submissionDocumentId: feed.pendingSubmissionDocumentId,
      })

      return { ok: true as const }
    },

    async disconnect(user: FeedUser, documentId: string) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      const { feed } = access
      if (feed.pendingSubmissionDocumentId)
        await submissions().updateStatus(
          feed.pendingSubmissionDocumentId,
          "rejected",
          systemReviewer(),
          "Withdrawn by the library"
        )
      await strapi.db.transaction(async () => {
        await strapi.db
          .query(EVENT_UID)
          .deleteMany({ where: { credentialId: feed.id } })
        await creds().delete({ documentId })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: feed.provider,
          libraryDocumentIds: libraryIdsOf(feed),
          action: feed.status === "pending" ? "withdrawn" : "disconnected",
          actor: actorOf(user),
        })
      })
      await credentialsService().syncLibraryFeedFlags(libraryIdsOf(feed))
      if (feed.status !== "pending")
        void notifyOtherClaimants(strapi, libraryIdsOf(feed), user.id, {
          subject: "An event feed was disconnected",
          text: `The ${EVENT_PROVIDERS[feed.provider as EventProviderKey].label} feed for ${feed.libraries?.[0]?.name ?? "your library"} was disconnected by another librarian. Its events have been removed. Reconnect it from ${process.env.APP_PUBLIC_URL ?? ""}/contribute/events.`,
        })

      return { ok: true as const }
    },

    /**
     * Applies an approved `event_feed` Submission: activates a connection,
     * or swaps a replacement's pending value into the current slot. Runs
     * inside the caller's transaction (the submission's own status change).
     * Throws `ApplyRefusedError("feed_mismatch")` when the credential isn't
     * waiting on this submission any more (withdrawn, replaced, already
     * decided), and `ApplyRefusedError("claim_lost")` when the submitter no
     * longer holds a claim on the library — both leave the submission at
     * its prior status (the generic refusal handling in
     * `submission.updateStatus` reverts and notes it).
     */
    async approveSubmission(
      submission: any
    ): Promise<{ credentialDocumentId: string }> {
      const f = (submission.fields ?? {}) as Record<string, any>
      const documentId = String(f.credentialDocumentId ?? "")
      const feed = await creds().findOne({
        documentId,
        fields: [...CREDENTIAL_PUBLIC_FIELDS, "pendingCredentialsEncrypted"],
        populate: { libraries: { fields: ["documentId"] } },
      })
      if (!feed || feed.pendingSubmissionDocumentId !== submission.documentId)
        throw new ApplyRefusedError("feed_mismatch", CREDENTIAL_UID, documentId)
      const claims = await claimedLibraryIds(
        strapi,
        submission.submittedByUserId
      )
      if (!libraryIdsOf(feed).some((id) => claims.has(id)))
        throw new ApplyRefusedError("claim_lost", CREDENTIAL_UID, documentId)

      if (f.kind === "replace") {
        if (!feed.pendingCredentialsEncrypted)
          throw new ApplyRefusedError(
            "feed_mismatch",
            CREDENTIAL_UID,
            documentId
          )
        const values = openValues(
          feed.pendingCredentialsEncrypted,
          documentId,
          "pending"
        )
        await creds().update({
          documentId,
          data: {
            credentialsEncrypted: sealValues(values, documentId, "current"),
            hints: feed.pendingHints ?? feed.hints,
            lastTestedAt: feed.pendingTestedAt ?? null,
            lastTestResult: feed.pendingTestResult ?? null,
            pendingCredentialsEncrypted: null,
            pendingHints: null,
            pendingTestedAt: null,
            pendingTestResult: null,
            pendingSubmissionDocumentId: null,
            submissionDocumentId: submission.documentId,
            consecutiveFailures: 0,
            lastErrorCode: null,
            ...(feed.status === "paused" &&
            feed.pausedReason === "sync_failures"
              ? {
                  status: "active",
                  pausedReason: null,
                  autoPauseNotifiedAt: null,
                }
              : {}),
          },
        })
      } else {
        await creds().update({
          documentId,
          data: {
            status: "active",
            pendingSubmissionDocumentId: null,
            submissionDocumentId: submission.documentId,
          },
        })
      }
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: feed.provider,
        libraryDocumentIds: libraryIdsOf(feed),
        action: "approved",
        actor: `ba:${submission.submittedByUserId}`,
        submissionDocumentId: submission.documentId,
        note: f.kind === "replace" ? "replace" : "connect",
      })
      await credentialsService().syncLibraryFeedFlags(libraryIdsOf(feed))
      await credentialsService().queueSync(documentId)

      return { credentialDocumentId: documentId }
    },

    /**
     * Applies a rejected `event_feed` Submission: deletes a pending
     * connection's credential, or clears a replacement's pending slot and
     * keeps the feed as it was. A no-op when the credential is already gone
     * or has moved on to a newer submission (withdrawn by the library, or
     * already decided elsewhere) — tolerated so a double-decision can't fail
     * the transaction.
     */
    async rejectSubmission(submission: any): Promise<void> {
      const f = (submission.fields ?? {}) as Record<string, any>
      const documentId = String(f.credentialDocumentId ?? "")
      const feed = await creds().findOne({
        documentId,
        fields: [
          "documentId",
          "provider",
          "pendingSubmissionDocumentId",
          "status",
        ],
      })
      if (!feed || feed.pendingSubmissionDocumentId !== submission.documentId)
        return
      await (f.kind === "replace"
        ? creds().update({
            documentId,
            data: {
              pendingCredentialsEncrypted: null,
              pendingHints: null,
              pendingTestedAt: null,
              pendingTestResult: null,
              pendingSubmissionDocumentId: null,
            },
          })
        : creds().delete({ documentId }))
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: feed.provider,
        action: "rejected",
        actor: `ba:${submission.submittedByUserId}`,
        submissionDocumentId: submission.documentId,
      })
    },
  }
}

export { FEED_TEST_COOLDOWN_MS }
