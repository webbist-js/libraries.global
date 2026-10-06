/**
 * Eventbrite OAuth: code exchange and organisation completion.
 *
 * Finding (Eventbrite platform docs, general OAuth app-flow behaviour,
 * checked 2026-10-06): the token response at `POST /oauth/token` is a plain
 * `{ access_token, token_type }` — no `expires_in` and no `refresh_token`.
 * An Eventbrite OAuth access token has no fixed lifetime; it keeps working
 * until the user revokes the app's access or changes their Eventbrite
 * password, at which point calls start failing and the user repeats the
 * OAuth flow from scratch — there's nothing to refresh. So this stores only
 * `accessToken`, with no `refreshToken` and no refresh logic, matching the
 * plan's assumption; no scope change needed.
 *
 * Organisations endpoint: `GET /v3/users/me/organizations/`, bearer-token
 * authenticated, returning `{ organizations: [{ id, name, ... }] }`.
 */
import { feedHints, MAX_FEEDS_PER_LIBRARY } from "@repo/shared-data"

import { CREDENTIAL_UID } from "./credentials"
import { sealValues } from "../utils/credential-crypto"
import { claimedLibraryIds } from "../utils/feed-access"

const LIBRARY_UID = "api::library.library"
const TOKEN_URL = "https://www.eventbrite.com/oauth/token"
const ORGS_URL = "https://www.eventbriteapi.com/v3/users/me/organizations/"

/** Credentials already on a library, for the `MAX_FEEDS_PER_LIBRARY` cap —
 * the same count `feeds.ts` keeps (kept here too since this draft is
 * created before any review opens, through its own transaction). */
async function feedsOnLibrary(
  strapi: any,
  libraryDocumentId: string
): Promise<number> {
  return strapi.documents(CREDENTIAL_UID).count({
    filters: { libraries: { documentId: { $in: [libraryDocumentId] } } },
  })
}

type Deps = {
  strapi: any
  http?: typeof fetch
  /** Finishes a draft: sets organizationId, tests, opens the review (feeds.completeDraft). */
  completeDraft?: (
    user: any,
    documentId: string,
    organizationId: string
  ) => Promise<any>
}

const fail = (status: number, name: string, message: string) => ({
  error: { status, name, message },
})

export default ({ strapi, http = fetch, completeDraft }: Deps) => {
  const complete =
    completeDraft ??
    ((u: any, id: string, org: string) =>
      strapi.plugin("events").service("feeds").completeDraft(u, id, org))

  return {
    async exchangeEventbrite(
      user: any,
      input: { code: string; libraryDocumentId: string }
    ) {
      const {
        EVENTBRITE_CLIENT_ID: id,
        EVENTBRITE_CLIENT_SECRET: secret,
        EVENTBRITE_REDIRECT_URI: redirect,
      } = process.env
      if (!id || !secret || !redirect)
        return fail(
          503,
          "oauth_unavailable",
          "Eventbrite sign-in isn't set up."
        )
      if (
        !(await claimedLibraryIds(strapi, user.id)).has(input.libraryDocumentId)
      )
        return fail(404, "not_found", "Library not found.")
      if (!/^[A-Za-z0-9._-]{4,512}$/.test(input.code))
        return fail(400, "invalid_code", "Invalid authorisation code.")

      // The same checks `feeds.connect` runs, before the draft is created:
      // `completeDraft` (and the OAuth dance itself) can take a while, so a
      // quota that's already exceeded shouldn't pay for a token exchange and
      // an organisations call first.
      const verdict = await strapi
        .plugin("content-moderation")
        .service("submission-policy")
        .check({
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
      if (
        (await feedsOnLibrary(strapi, input.libraryDocumentId)) >=
        MAX_FEEDS_PER_LIBRARY
      )
        return fail(
          409,
          "too_many_feeds",
          `A library can have at most ${MAX_FEEDS_PER_LIBRARY} feeds.`
        )

      const tokenRes = await http(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: id,
          client_secret: secret,
          code: input.code,
          redirect_uri: redirect,
        }).toString(),
        signal: AbortSignal.timeout(15_000),
      })
      const token = (await tokenRes.json().catch(() => null)) as {
        access_token?: string
      } | null
      if (!tokenRes.ok || !token?.access_token)
        return fail(
          502,
          "oauth_failed",
          "Eventbrite didn't accept the sign-in. Try again."
        )

      const orgRes = await http(ORGS_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15_000),
      })
      const orgJson = (await orgRes.json().catch(() => null)) as {
        organizations?: { id: string; name: string }[]
      } | null
      const organizations = (orgJson?.organizations ?? [])
        .map((o) => ({ id: String(o.id), name: String(o.name ?? o.id) }))
        .slice(0, 50)
      if (organizations.length === 0)
        return fail(
          422,
          "no_organizations",
          "That Eventbrite account has no organisations."
        )

      const values = { accessToken: token.access_token }
      const library = await strapi
        .documents(LIBRARY_UID)
        .findOne({ documentId: input.libraryDocumentId, fields: ["name"] })
      const draft = await strapi.db.transaction(async () => {
        const created = await strapi.documents(CREDENTIAL_UID).create({
          data: {
            provider: "eventbrite",
            label: `${String(library?.name ?? "Library").slice(0, 150)} · Eventbrite`,
            scope: "library",
            status: "draft",
            source: "library",
            connectedBy: `ba:${user.id}`,
            credentialsEncrypted: "{}",
            hints: { ...feedHints("eventbrite", values), organizations },
            libraries: [{ documentId: input.libraryDocumentId }],
          },
        })
        await strapi.documents(CREDENTIAL_UID).update({
          documentId: created.documentId,
          data: {
            credentialsEncrypted: sealValues(
              values,
              created.documentId,
              "current"
            ),
          },
        })

        return created
      })

      if (organizations.length === 1)
        return {
          credentialDocumentId: draft.documentId,
          organizations,
          completed: await complete(
            user,
            draft.documentId,
            organizations[0]!.id
          ),
        }

      return { credentialDocumentId: draft.documentId, organizations }
    },

    completeEventbrite: (
      user: any,
      documentId: string,
      organizationId: string
    ) => complete(user, documentId, organizationId),
  }
}
