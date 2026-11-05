import { expect, it } from "vitest"

import peopleService from "../../src/plugins/access/server/services/people"
import plansService from "../../src/plugins/access/server/services/plans"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const AUTH = "plugin::better-auth.user"
const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"

function fixture() {
  const fake = makeFakeStrapi({
    [AUTH]: [
      {
        id: 7,
        documentId: "account",
        email: "owner@example.test",
        emailVerified: true,
        privateProbe: "secret",
      },
      {
        id: 8,
        documentId: "unverified",
        email: "pending@example.test",
        emailVerified: false,
      },
    ],
    [PROFILE]: [
      {
        documentId: "profile",
        baUserId: "7",
        username: "new_owner",
        firstName: "New",
        lastName: "Owner",
      },
      { documentId: "other-profile", baUserId: "8", username: "pending" },
    ],
    [SUBMISSION]: [
      {
        documentId: "old",
        submittedByUserId: "8",
        submittedByEmail: "owner@example.test",
      },
      {
        documentId: "old-email",
        submittedByUserId: "7",
        submittedByEmail: "retired@example.test",
      },
    ],
  })
  const people = peopleService({ strapi: fake.strapi })
  fake.services["access.people"] = people

  return { ...fake, people }
}

it("finds a new account by canonical email without relying on submission attribution", async () => {
  const { people } = fixture()
  const rows = await people.search("owner@example.test")
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    baUserId: "7",
    email: "owner@example.test",
    username: "new_owner",
  })
  expect(JSON.stringify(rows)).not.toContain("privateProbe")
  expect(await people.search("retired@example.test")).toEqual([])
})

it("resolves only current verified emails and never a historical or unverified match", async () => {
  const { people } = fixture()
  expect(await people.baUserIdByEmail(" OWNER@EXAMPLE.TEST ")).toBe("7")
  expect(await people.baUserIdByEmail("pending@example.test")).toBeNull()
  expect(await people.baUserIdByEmail("retired@example.test")).toBeNull()
})

it("grants a plan to the verified account rather than the historical email author", async () => {
  const { strapi } = fixture()
  const plans = plansService({ strapi })
  const grant = await plans.createGrant(
    {
      person: "owner@example.test",
      plan: "team",
      reason: "Owner-approved complimentary access",
      expiresAt: null,
    },
    1
  )
  expect(grant.baUserId).toBe("7")
  await expect(
    plans.createGrant(
      {
        person: "pending@example.test",
        plan: "team",
        reason: "Test",
        expiresAt: null,
      },
      1
    )
  ).rejects.toMatchObject({ status: 404 })
})
