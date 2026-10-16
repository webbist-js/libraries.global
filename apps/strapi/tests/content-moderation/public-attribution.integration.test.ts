import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setupStrapi, strapi, teardownStrapi } from "../helpers/strapi"

const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const CHANGE = "api::article-change.article-change"
const ROLE = "api::role-grant.role-grant"
const PLAN = "api::entitlement-grant.entitlement-grant"
const VERIFY = "api::pro-verification.pro-verification"
const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
const articleDocumentId = randomUUID().replaceAll("-", "").slice(0, 24)
const identities = ["public", "limited", "private", "hidden"].map(
  (visibility) => ({
    baUserId: `attribution-${suffix}-${visibility}`,
    username: `attribution_${suffix}_${visibility}`,
    profileVisibility: visibility === "hidden" ? "public" : visibility,
    publicPrefs: { showActivity: visibility !== "hidden" },
    documentId: "",
  })
)
const users = identities.map((profile) => profile.baUserId)
const secrets = [
  ...users,
  "private-editor-note",
  "private-review-note",
  "private-evidence",
  "Private actor name",
  "private@example.test",
]

describe.skipIf(process.env.COMMUNITY_ATTRIBUTION_INTEGRATION !== "1")(
  "public contribution attribution on the full Strapi host",
  () => {
    let baseUrl: string
    beforeAll(async () => {
      const contents = readFileSync(".env", "utf8")
      const value = (name: string) =>
        process.env[name] ??
        contents
          .split("\n")
          .find((line) => line.startsWith(`${name}=`))
          ?.slice(name.length + 1)
          .replaceAll(/^['"]|['"]$/g, "")
      if (
        !["127.0.0.1", "localhost"].includes(value("DATABASE_HOST") ?? "") ||
        value("DATABASE_PORT") !== "5433" ||
        value("DATABASE_NAME") !== "community_publishing_acceptance"
      )
        throw new Error(
          "Attribution integration requires the isolated local community publishing acceptance database"
        )
      await setupStrapi()
      const server = strapi.server.httpServer
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      )
      const address = server.address()
      if (!address || typeof address === "string")
        throw new Error("HTTP fixture unavailable")
      baseUrl = `http://127.0.0.1:${address.port}`
      for (const profile of identities) {
        const created = await strapi.documents(PROFILE).create({
          data: {
            baUserId: profile.baUserId,
            username: profile.username,
            profileVisibility: profile.profileVisibility as
              | "public"
              | "limited"
              | "private",
            publicPrefs: profile.publicPrefs,
          },
        })
        profile.documentId = created.documentId
        for (const status of ["approved", "pending"] as const) {
          await strapi.documents(SUBMISSION).create({
            data: {
              submittedByUserId: profile.baUserId,
              submittedByEmail: "private@example.test",
              submissionType: "wiki_edit",
              status,
              reviewedAt: new Date().toISOString(),
              note: "private-editor-note",
              reviewNote: "private-review-note",
              fields: { evidence: "private-evidence" },
            },
          })
        }
        for (const versionStatus of ["published", "draft"] as const) {
          await strapi.documents(CHANGE).create({
            data: {
              articleKind: "wiki",
              articleDocumentId,
              contentLocale: "en",
              versionStatus,
              kind: "edited",
              actorKind: "contributor",
              actorId: `ba:${profile.baUserId}`,
              actorName: "Private actor name",
              editSummary: `${profile.username}-${versionStatus}`,
              changedAt: new Date().toISOString(),
            },
          })
        }
      }
    }, 60000)

    afterAll(async () => {
      if (baseUrl) {
        await strapi.db
          .query(CHANGE)
          .deleteMany({ where: { articleDocumentId } })
        await strapi.db
          .query(SUBMISSION)
          .deleteMany({ where: { submittedByUserId: { $in: users } } })
        for (const uid of [
          ROLE,
          PLAN,
          VERIFY,
          "api::notification.notification",
        ])
          await strapi.db
            .query(uid as any)
            .deleteMany({ where: { baUserId: { $in: users } } })
        await strapi.db
          .query(PROFILE)
          .deleteMany({ where: { baUserId: { $in: users } } })
      }
      await teardownStrapi()
    }, 30000)

    const publicJson = async (path: string, status = 200) => {
      const response = await fetch(`${baseUrl}/api${path}`)
      const result = await response.json()
      expect(response.status).toBe(status)
      const serialized = JSON.stringify(result)
      for (const secret of secrets) expect(serialized).not.toContain(secret)
      expect(serialized).not.toContain("baUserId")

      return result
    }

    it("shows only approved public activity by both profile ID and username", async () => {
      for (const profile of identities) {
        for (const path of [
          `/content-moderation/submissions/by-username/${profile.username}`,
          `/content-moderation/submissions/by-document-id/${profile.documentId}`,
        ]) {
          const result = await publicJson(path)
          expect(result.data).toHaveLength(profile === identities[0] ? 1 : 0)
          if (result.data[0])
            expect(result.data[0]).toMatchObject({
              status: "approved",
              submissionType: "wiki_edit",
            })
        }
      }
    })

    it("names permitted history contributors and keeps draft changes and stored actor names private", async () => {
      const result = await publicJson(
        `/content-moderation/articles/wiki/${articleDocumentId}/history`
      )
      expect(result.data).toHaveLength(4)
      expect(
        result.data.map((entry: any) => entry.actor.username).filter(Boolean)
      ).toEqual([identities[0].username])
      expect(
        result.data.every((entry: any) =>
          entry.editSummary.endsWith("-published")
        )
      ).toBe(true)
      expect(
        result.data.every(
          (entry: any) =>
            Object.keys(entry.actor).sort().join(",") === "kind,username"
        )
      ).toBe(true)
    })

    it("uses public contributor DTOs and hides profiles whose activity is restricted", async () => {
      const result = await publicJson("/wiki-articles/top-contributors")
      expect(result.data).toContainEqual({
        documentId: identities[0].documentId,
        username: identities[0].username,
        avatar: null,
      })
      for (const profile of identities.slice(1))
        expect(
          result.data.some((row: any) => row.username === profile.username)
        ).toBe(false)
      expect(JSON.stringify(result)).not.toMatch(
        /profileVisibility|publicPrefs|notifPrefs/
      )
    })

    it("resolves public badges and drives while rejecting anonymous restricted-profile reads", async () => {
      for (const profile of identities) {
        for (const path of [
          `/user-profiles/by-username/${profile.username}/badges`,
          `/user-profiles/by-document-id/${profile.documentId}/badges`,
          `/user-profiles/by-username/${profile.username}/drives`,
        ]) {
          const result = await publicJson(
            path,
            profile === identities[0] ? 200 : 404
          )
          if (profile === identities[0]) expect(result.data).toEqual([])
        }
      }
    })

    it("resolves the admin role and plan rosters from trusted private profile identities", async () => {
      const profile = identities[0]
      await strapi.documents(ROLE).create({
        data: {
          baUserId: profile.baUserId,
          role: "wiki_editor",
          queue: "all",
          source: "migration",
        },
      })
      await strapi.documents(PLAN).create({
        data: { baUserId: profile.baUserId, plan: "pro", source: "admin" },
      })
      await strapi
        .documents(VERIFY)
        .create({ data: { baUserId: profile.baUserId, kind: "library_staff" } })
      const people = strapi.plugin("access").service("people")
      expect(await people.namesOf([profile.baUserId])).toEqual(
        new Map([[profile.baUserId, `@${profile.username}`]])
      )
      expect(await people.search(profile.username)).toMatchObject([
        {
          baUserId: profile.baUserId,
          username: profile.username,
          contributorRole: "wiki_editor",
          activeGrants: 1,
        },
      ])
      expect(await people.person(profile.baUserId)).toMatchObject({
        username: profile.username,
        grants: [{ role: "wiki_editor", status: "active" }],
      })
      const plans = strapi.plugin("access").service("plans")
      expect(await plans.listGrants(profile.baUserId)).toMatchObject([
        { baUserId: profile.baUserId, plan: "pro" },
      ])
      expect(await plans.listVerifications(profile.baUserId)).toMatchObject([
        { baUserId: profile.baUserId, kind: "library_staff" },
      ])
    })
  }
)
