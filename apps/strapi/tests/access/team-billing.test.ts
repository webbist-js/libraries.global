import type { Core } from "@strapi/strapi"
import { beforeEach, describe, expect, it, vi } from "vitest"

import createBilling from "../../src/plugins/access/server/services/team-billing"
import createTeams from "../../src/plugins/access/server/services/teams"
import {
  teamIsActive,
  TEAM_UID,
  TEAM_MEMBER_UID,
} from "../../src/utils/team-access"
import { makeFakeStrapi, materialiseRelations } from "../helpers/fake-strapi"

const accountId = "c62d1460-9436-4710-a999-b576e96b0acd"
const teamId = "team00000000000000000001"
const membership = () => ({
  mode: "sandbox",
  status: "active",
  priceId: "price_team",
  unitAmount: 12000,
  currency: "gbp",
  seats: 5,
  paidSeats: 5,
  paidThrough: "2099-01-01T00:00:00.000Z",
  accessUntil: "2099-01-01T00:00:00.000Z",
  pastDueSince: null,
  pendingSeats: null,
  pendingAt: null,
  revoked: false,
  cancelAtPeriodEnd: false,
})
function setup(extraMembers = 0, over: Record<string, unknown> = {}) {
  const team = {
    documentId: teamId,
    name: "Test Team",
    slug: "test-team",
    source: "checkout",
    status: "lapsed",
    seats: 5,
    billingAccountId: accountId,
    billingMode: "sandbox",
    billingRevision: 0,
    verifiedAt: null,
    libraries: [],
    ...over,
  }
  const fake = makeFakeStrapi({
    [TEAM_UID]: [team],
    [TEAM_MEMBER_UID]: [
      {
        documentId: "organiser0000000000000001",
        team,
        baUserId: "owner",
        email: "owner@example.invalid",
        teamRole: "organiser",
        status: "active",
      },
      ...Array.from({ length: extraMembers }, (_, i) => ({
        documentId: `member00000000000000000${i}`,
        team,
        baUserId: `member${i}`,
        teamRole: "member",
        status: "active",
      })),
    ],
    "api::user-profile.user-profile": [
      {
        documentId: "profile00000000000000001",
        baUserId: "owner",
        username: "owner",
      },
    ],
  })
  materialiseRelations(fake, TEAM_MEMBER_UID, ["team"])
  materialiseRelations(fake, TEAM_UID, ["libraries"])
  fake.services["access.people"] = { namesOf: async () => new Map() }
  fake.services["api::notification.notification"] = { enqueue: vi.fn() }
  const teams = createTeams({ strapi: fake.strapi })
  fake.services["access.teams"] = teams

  return {
    ...fake,
    teams,
    billing: createBilling({ strapi: fake.strapi as unknown as Core.Strapi }),
  }
}
beforeEach(() => {
  vi.stubEnv("BILLING_ENV", "sandbox")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
})
describe("Team billing bridge", () => {
  it("applies paid access without changing verification or staff roles", async () => {
    const { billing, store } = setup()
    await billing.sync({
      accountId,
      teamId,
      revision: 1,
      membership: membership(),
    })
    expect(store[TEAM_UID]![0]).toMatchObject({
      status: "active",
      seats: 5,
      billingRevision: 1,
      verifiedAt: null,
    })
    expect(store[TEAM_MEMBER_UID]![0]).toMatchObject({
      teamRole: "organiser",
      status: "active",
    })
    await billing.sync({
      accountId,
      teamId,
      revision: 2,
      membership: { ...membership(), revoked: true, accessUntil: null },
    })
    await billing.sync({
      accountId,
      teamId,
      revision: 1,
      membership: membership(),
    })
    expect(store[TEAM_UID]![0]!.status).toBe("lapsed")
  })
  it("fails closed on capacity and recovers the same revision after members are removed", async () => {
    const { billing, store } = setup(5)
    const result = await billing.sync({
      accountId,
      teamId,
      revision: 1,
      membership: membership(),
    })
    expect(result.capacityBlocked).toBe(true)
    expect(store[TEAM_UID]![0]!.status).toBe("lapsed")
    store[TEAM_MEMBER_UID]!.pop()
    expect(
      (
        await billing.sync({
          accountId,
          teamId,
          revision: 1,
          membership: membership(),
        })
      ).capacityBlocked
    ).toBe(false)
    expect(store[TEAM_UID]![0]!.status).toBe("active")
  })
  it("rejects wrong environment, binding and conflicting revisions", async () => {
    const { billing } = setup()
    await expect(
      billing.sync({
        accountId,
        teamId,
        revision: 1,
        membership: { ...membership(), mode: "live" },
      })
    ).rejects.toThrow("invalid_team_membership")
    await expect(
      billing.sync({
        accountId: "11111111-1111-1111-1111-111111111111",
        teamId,
        revision: 1,
        membership: membership(),
      })
    ).rejects.toThrow("binding_invalid")
    await billing.sync({
      accountId,
      teamId,
      revision: 2,
      membership: membership(),
    })
    await expect(
      billing.sync({
        accountId,
        teamId,
        revision: 2,
        membership: { ...membership(), seats: 7 },
      })
    ).rejects.toThrow("revision_conflict")
  })
  it("rechecks organiser membership and preserves operator suspension", async () => {
    const { billing, store } = setup(0, { billingSuspended: true })
    await expect(
      billing.context({ teamId, baUserId: "outsider", mode: "sandbox" })
    ).rejects.toThrow()
    await billing.sync({
      accountId,
      teamId,
      revision: 1,
      membership: membership(),
    })
    expect(store[TEAM_UID]![0]!.status).toBe("lapsed")
    await expect(billing.deletionCheck({ baUserId: "owner" })).rejects.toThrow(
      "transfer_team_before_deletion"
    )
  })
  it("creates an inactive organisation and organiser exactly once", async () => {
    const { billing, store } = setup()
    const id = "11111111-1111-4111-8111-111111111111"
    const input = {
      accountId: id,
      mode: "sandbox",
      name: "New Team",
      baUserId: "owner",
      email: "owner@example.invalid",
    }
    const first = await billing.create({
      ...input,
      publicServiceRequested: true,
    })
    expect(await billing.create(input)).toEqual(first)
    expect(
      store[TEAM_UID]!.filter((t) => t.billingAccountId === id)
    ).toHaveLength(1)
    expect(
      store[TEAM_UID]!.find((t) => t.billingAccountId === id)
    ).toMatchObject({
      source: "checkout",
      status: "lapsed",
      verifiedAt: null,
      publicServiceApproved: false,
      notes:
        "Public-library-service eligibility check requested during signup.",
    })
  })
  it("rejects sandbox Teams as active in a live CMS", () => {
    vi.stubEnv("BILLING_ENV", "live")
    expect(
      teamIsActive({
        status: "active",
        source: "checkout",
        billingMode: "sandbox",
      })
    ).toBe(false)
    expect(teamIsActive({ status: "active", source: "admin" })).toBe(true)
  })
  it("checks the last Organiser again while holding the Team erasure lock", async () => {
    const { teams } = setup()
    await expect(
      teams.eraseFor("owner", "owner@example.invalid")
    ).rejects.toThrow("transfer_team_before_deletion")
  })
})
