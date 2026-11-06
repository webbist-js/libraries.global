import { describe, expect, it } from "vitest"

import peopleService from "../../src/plugins/access/server/services/people"
import { loadEntitlementInputs } from "../../src/utils/entitlement-inputs"
import { nextContributorNumber } from "../../src/utils/username"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const ROLE = "api::role-grant.role-grant"
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
          ["baUserId", "recognitionRevokedAt", "contributorNumber"].includes(
            field
          )
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
      ["plugin::better-auth.user"]: [
        {
          id: 7,
          documentId: "auth-user",
          email: "editor@example.test",
          emailVerified: true,
        },
      ],
      [PROFILE]: [
        {
          documentId: "profile",
          baUserId: "7",
          username: "editor",
          firstName: "Jane",
          lastName: "Reader",
          notifPrefs: { marketing: true },
          contributorRole: "wiki_editor",
          contributorNumber: 42,
          tier: "Reader",
          acceptedContributions: 3,
          recognitionRevokedAt: null,
        },
      ],
      [ROLE]: [
        {
          documentId: "role",
          baUserId: "7",
          role: "wiki_editor",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
      [SUBMISSION]: [
        {
          documentId: "accepted",
          submittedByUserId: "7",
          submittedByEmail: "editor@example.test",
          status: "approved",
          submissionType: "wiki_edit",
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
    expect(await people.namesOf(["7", "7"])).toEqual(
      new Map([["7", "Jane Reader"]])
    )
    expect(await people.profile("7")).toMatchObject({ baUserId: "7" })
    expect(await people.search("")).toEqual([
      {
        baUserId: "7",
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

  it("loads earned access and contributor numbering without selecting private Document Service fields", async () => {
    const { strapi } = fixture()
    expect(await loadEntitlementInputs(strapi, "7")).toEqual({
      acceptedContributions: 3,
      recognitionRevoked: false,
      apiAccounts: [],
    })
    expect(await nextContributorNumber(strapi)).toBe(43)
    expect(await loadEntitlementInputs(strapi, "unknown")).toEqual({
      acceptedContributions: 0,
      recognitionRevoked: false,
      apiAccounts: [],
    })
  })
})
