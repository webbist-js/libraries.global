import { createHash } from "node:crypto"

import { validate } from "@strapi/utils"
import { afterEach, expect, it, vi } from "vitest"

import createTeams from "../../src/plugins/access/server/services/teams"
import {
  loadTeamMemberships,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../../src/utils/team-access"
import { makeFakeStrapi } from "../helpers/fake-strapi"

import librarySchema from "../../src/api/library/content-types/library/schema.json"
import libraryTypeSchema from "../../src/api/library-type/content-types/library-type/schema.json"
import teamSchema from "../../src/plugins/access/server/content-types/team/schema.json"
import memberSchema from "../../src/plugins/access/server/content-types/team-member/schema.json"

afterEach(() => vi.unstubAllGlobals())

it("loads membership and invitation projections through Strapi's real nested-query validation", async () => {
  vi.stubGlobal("strapi", { config: { get: () => [] } })
  const token = "a".repeat(64)
  const team = {
    documentId: "team00000000000000000001",
    name: "API acceptance",
    status: "active",
    expiresAt: null,
    notes: "Private administrator notes",
    source: "checkout",
    billingMode: process.env.BILLING_ENV === "live" ? "live" : "sandbox",
    libraries: [],
  }
  const fake = makeFakeStrapi({
    [TEAM_MEMBER_UID]: [
      {
        documentId: "active000000000000000001",
        baUserId: "fixture_user",
        teamRole: "organiser",
        status: "active",
        team,
      },
      {
        documentId: "othermode000000000000001",
        baUserId: "fixture_user",
        teamRole: "member",
        status: "active",
        team: {
          ...team,
          documentId: "otherteam000000000000001",
          billingMode: team.billingMode === "live" ? "sandbox" : "live",
        },
      },
      {
        documentId: "teammember00000000000001",
        email: "organiser@example.test",
        teamRole: "organiser",
        status: "invited",
        tokenHash: createHash("sha256").update(token).digest("hex"),
        invitedBy: "admin:1",
        invitedAt: new Date().toISOString(),
        preassign: null,
        team,
      },
    ],
  })
  const schemas = {
    [TEAM_MEMBER_UID]: memberSchema,
    [TEAM_UID]: teamSchema,
    "api::library.library": librarySchema,
    "api::library-type.library-type": libraryTypeSchema,
  }
  const models: Record<string, any> = Object.fromEntries(
    Object.entries(schemas).map(([uid, schema]) => [
      uid,
      {
        ...schema,
        uid,
        modelType: "contentType",
        attributes: {
          ...schema.attributes,
          documentId: { type: "string" },
          createdAt: { type: "datetime" },
        },
      },
    ])
  )
  const documents = fake.strapi.documents.getMockImplementation()!
  vi.spyOn(fake.strapi, "documents").mockImplementation((uid: string) => {
    const repository = documents(uid)

    return {
      ...repository,
      findMany: async (params: any) => {
        // The in-memory repository alone does not validate populated fields.
        // Use the installed Strapi validator and actual schemas at that seam.
        if (params.populate)
          await validate.validators.defaultValidatePopulate(
            { schema: models[uid], getModel: (target) => models[target] },
            params.populate
          )

        return repository.findMany(params)
      },
    }
  })
  const memberships = await loadTeamMemberships(fake.strapi, "fixture_user")
  expect(memberships).toHaveLength(2)
  expect(memberships[0]).toMatchObject({
    name: "API acceptance",
    status: "active",
    teamRole: "organiser",
  })
  expect(memberships[1]).toMatchObject({ status: "lapsed" })
  expect(memberships[0]).not.toHaveProperty("billingMode")
  expect(memberships[0]).not.toHaveProperty("notes")
  const teams = createTeams({ strapi: fake.strapi })

  await expect(
    teams.preview(token, "organiser@example.test")
  ).resolves.toMatchObject({
    teamName: "API acceptance",
    teamRole: "organiser",
    emailMatches: true,
    status: "open",
  })
})
