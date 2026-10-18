import { describe, expect, it } from "vitest"

import peopleService from "../../src/plugins/access/server/services/people"
import plansService from "../../src/plugins/access/server/services/plans"
import { loadEntitlementInputs } from "../../src/utils/entitlement-inputs"
import { migrateContributorRolesToGrants } from "../../src/utils/role-grants"
import { nextContributorNumber } from "../../src/utils/username"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const ROLE = "api::role-grant.role-grant"
const PLAN = "api::entitlement-grant.entitlement-grant"
const VERIFICATION = "api::pro-verification.pro-verification"
const SUBMISSION = "plugin::content-moderation.submission"

/** Match Strapi's rejection of explicit private attribute selection. */
function refusePrivateDocumentFields(strapi: any) {
  const original = strapi.documents.getMockImplementation()!
  strapi.documents.mockImplementation((uid: string) => {
    const service = original(uid)
    for (const method of ["findOne", "findMany"]) {
      const read = service[method]
      service[method] = async (query: any) => {
        const privateField = query.fields?.find((field: string) =>
          ["baUserId", "earnedProUntil", "contributorNumber"].includes(field)
        )
        if (privateField) throw new Error(`Invalid key ${privateField}`)

        return read(query)
      }
    }

    return service
  })
}

describe("admin contribution identity reads", () => {
  const fixture = () => {
    const fake = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "profile",
          baUserId: "member",
          username: "editor",
          firstName: "Jane",
          lastName: "Reader",
          notifPrefs: { marketing: true },
          contributorRole: "wiki_editor",
          contributorNumber: 42,
          tier: "Reader",
          earnedProUntil: "2099-01-01T00:00:00.000Z",
        },
      ],
      [ROLE]: [
        {
          documentId: "role",
          baUserId: "member",
          role: "wiki_editor",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
      [SUBMISSION]: [
        {
          documentId: "accepted",
          submittedByUserId: "member",
          submittedByEmail: "editor@example.test",
          status: "approved",
          submissionType: "wiki_edit",
        },
      ],
      [PLAN]: [
        {
          documentId: "plan",
          baUserId: "member",
          plan: "pro",
          expiresAt: null,
          privateProbe: "hidden",
        },
      ],
      [VERIFICATION]: [
        {
          documentId: "verified",
          baUserId: "member",
          kind: "library_staff",
          expiresAt: null,
          privateProbe: "hidden",
        },
      ],
    })
    refusePrivateDocumentFields(fake.strapi)
    fake.services["access.people"] = peopleService({ strapi: fake.strapi })

    return fake
  }

  it("resolves private profile identities for names, recent role rosters and profile lookups", async () => {
    const { strapi, services } = fixture()
    const people = services["access.people"]
    expect(await people.namesOf(["member", "member"])).toEqual(
      new Map([["member", "Jane Reader"]])
    )
    expect(await people.profile("member")).toMatchObject({ baUserId: "member" })
    expect(await people.search("")).toEqual([
      {
        baUserId: "member",
        documentId: "profile",
        username: "editor",
        displayName: "Jane Reader",
        email: "editor@example.test",
        contributorRole: "wiki_editor",
        activeGrants: 1,
      },
    ])
    expect(strapi.db.query).toHaveBeenCalledWith(PROFILE)
  })

  it("keeps Plans and verification rosters on explicit admin DTOs", async () => {
    const { strapi } = fixture()
    const plans = plansService({ strapi })
    expect(await plans.listGrants("member")).toMatchObject([
      {
        baUserId: "member",
        name: "Jane Reader",
        plan: "pro",
        status: "active",
      },
    ])
    expect(await plans.listVerifications("member")).toMatchObject([
      {
        baUserId: "member",
        name: "Jane Reader",
        kind: "library_staff",
        status: "active",
      },
    ])
    expect(JSON.stringify(await plans.listGrants())).not.toContain(
      "privateProbe"
    )
    expect(JSON.stringify(await plans.listVerifications())).not.toContain(
      "privateProbe"
    )
  })

  it("backfills roles with a trusted identity query while keeping writes on Document Service", async () => {
    const { strapi } = fixture()
    strapi.store = () => ({ get: async () => null, set: async () => {} })
    await expect(migrateContributorRolesToGrants(strapi)).resolves.toEqual({
      migrated: 0,
    })
    const profileRead =
      strapi.db.query.mock.results[
        strapi.db.query.mock.calls.findIndex(
          ([uid]: [string]) => uid === PROFILE
        )
      ].value
    expect(profileRead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: ["baUserId", "contributorRole", "isVerifiedLibrarian"],
        offset: 0,
        limit: 200,
      })
    )
  })

  it("loads earned access and contributor numbering without selecting private Document Service fields", async () => {
    const { strapi } = fixture()
    expect(await loadEntitlementInputs(strapi, "member")).toMatchObject({
      tier: "Reader",
      earnedProUntil: "2099-01-01T00:00:00.000Z",
      teams: [],
    })
    expect(await nextContributorNumber(strapi)).toBe(43)
    expect(await loadEntitlementInputs(strapi, "unknown")).toMatchObject({
      tier: null,
      earnedProUntil: null,
    })
  })
})
