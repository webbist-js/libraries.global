import { createHash, randomBytes } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createTeams, {
  teamTransaction,
} from "../../src/plugins/access/server/services/teams"
import { AFFILIATION_UID } from "../../src/utils/staff"
import {
  hasLibraryFeature,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../../src/utils/team-access"
import { makeFakeStrapi, materialiseRelations } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const ROLE = "api::role-grant.role-grant"
const SUBMISSION = "plugin::content-moderation.submission"
const LIB_A = "libraryaaaaaaaaaaaaaaaa1"
const LIB_B = "librarybbbbbbbbbbbbbbbb1"
const TEAM = "team00000000000000000001"
const ORGANISER = "teammember00000000000001"
const MEMBER = "teammember00000000000002"
const INVITED = "teammember00000000000003"
const DAY = 86_400_000

const libA = {
  documentId: LIB_A,
  name: "Library A",
  slug: "library-a",
  libraryType: "Public",
}
const libB = {
  ...libA,
  documentId: LIB_B,
  name: "Library B",
  slug: "library-b",
}
const team = (over: Record<string, unknown> = {}) => ({
  documentId: TEAM,
  name: "Kent Libraries",
  slug: "kent-libraries",
  seats: 3,
  status: "active",
  source: "admin",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  libraries: [libA, libB],
  ...over,
})
const member = (
  documentId: string,
  baUserId: string | null,
  email: string,
  teamRole: "organiser" | "member",
  status: "invited" | "active" | "removed",
  t: ReturnType<typeof team>,
  over: Record<string, unknown> = {}
) => ({
  documentId,
  baUserId,
  email,
  teamRole,
  status,
  invitedBy: "org",
  invitedAt: "2026-01-01T00:00:00.000Z",
  acceptedAt: status === "active" ? "2026-01-02T00:00:00.000Z" : null,
  tokenHash: null,
  preassign: null,
  createdAt: `2026-01-0${documentId.at(-1)}T00:00:00.000Z`,
  team: t,
  ...over,
})
const organiser = {
  kind: "user",
  baUserId: "org",
  email: "org@example.org",
  name: "Olive Organiser",
} as const
const memberActor = {
  kind: "user",
  baUserId: "mem",
  email: "mem@example.org",
  name: "Mo Member",
} as const
const sha256 = (token: string) =>
  createHash("sha256").update(token).digest("hex")

function setup(
  teamOver: Record<string, unknown> = {},
  extra: Record<string, any[]> = {}
) {
  const t = team(teamOver)
  const fake = makeFakeStrapi({
    [LIBRARY]: [libA, libB],
    [TEAM_UID]: [t],
    [TEAM_MEMBER_UID]: [
      member(ORGANISER, "org", "org@example.org", "organiser", "active", t),
      member(MEMBER, "mem", "mem@example.org", "member", "active", t),
    ],
    [AFFILIATION_UID]: [],
    [ROLE]: [],
    [SUBMISSION]: [],
    ...extra,
  })
  materialiseRelations(fake, AFFILIATION_UID, ["library", "teamMember"])
  materialiseRelations(fake, TEAM_MEMBER_UID, ["team"])
  fake.services["access.people"] = {
    namesOf: vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, `Name ${id}`]))
    ),
  }
  fake.services["email.email"] = { send: vi.fn().mockResolvedValue({}) }
  fake.services["content-moderation.submission"] = {
    create: vi.fn(async (input: Record<string, unknown>) =>
      fake.strapi
        .documents(SUBMISSION)
        .create({ data: { ...input, status: "pending" } })
    ),
  }
  const teams = createTeams({ strapi: fake.strapi })
  fake.services["access.teams"] = teams

  return { ...fake, teams, team: t }
}
beforeEach(() => {
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.example")
  // A configured provider (`emailConfigured`), so invite emails are sent
  // rather than logged and skipped.
  vi.stubEnv("MAILGUN_API_KEY", "test-key")
  vi.stubEnv("MAILGUN_DOMAIN", "libraries.example")
})
afterEach(() => vi.unstubAllEnvs())

describe("team seats and invites", () => {
  it("takes the account and Team locks in order inside one transaction", async () => {
    const raw = vi.fn()
    const transaction = vi.fn(async (work) => work({ trx: { raw } }))
    const work = vi.fn().mockResolvedValue("accepted")
    expect(
      await teamTransaction(
        { db: { transaction } },
        ["membership:reader", TEAM],
        work
      )
    ).toBe("accepted")
    expect(transaction).toHaveBeenCalledOnce()
    expect(raw.mock.calls.map(([, values]) => values)).toEqual([
      ["access-team:membership:reader"],
      [`access-team:${TEAM}`],
    ])
    expect(work).toHaveBeenCalledOnce()
  })
  it("does not accept another Team while an account holds a seat, including on a lapsed Team", async () => {
    const { teams, store } = setup()
    const other = team({
      documentId: "team00000000000000000002",
      status: "lapsed",
    })
    store[TEAM_UID]!.push(other)
    store[TEAM_MEMBER_UID]!.push(
      member(
        "othermember0000000000001",
        "new",
        "new@example.org",
        "member",
        "active",
        other
      )
    )
    await teams.invite(TEAM, "new@example.org", "member", undefined, organiser)
    const invite = store[TEAM_MEMBER_UID]!.find((r) => r.status === "invited")!
    const token = "a".repeat(64)
    invite.tokenHash = sha256(token)
    await expect(
      teams.accept(token, { id: "new", email: "new@example.org", name: "New" })
    ).rejects.toMatchObject({ status: 409, code: "team_membership_exists" })
    expect(invite.status).toBe("invited")
    expect(invite.tokenHash).toBe(sha256(token))
  })
  it("holds a seat per invite, emails a hashed link, and refuses the invite past the seat count", async () => {
    const { teams, store, services } = setup()
    const invited = await teams.invite(
      TEAM,
      " New@Example.org ",
      "member",
      { libraryDocumentId: LIB_A, staffRole: "editor" },
      organiser
    )
    expect(invited.emailSent).toBe(true)
    expect(invited.member).toMatchObject({
      status: "invited",
      emailMasked: "n•••@example.org",
      preassign: { libraryDocumentId: LIB_A, staffRole: "editor" },
    })
    const row = store[TEAM_MEMBER_UID]!.find(
      (r) => r.email === "new@example.org"
    )!
    expect(row).toMatchObject({ status: "invited", team: { documentId: TEAM } })
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    const mail = services["email.email"].send.mock.calls[0]![0]
    expect(mail.to).toBe("new@example.org")
    const token = (mail.text as string).match(/join\/([a-f0-9]{64})/)![1]!
    expect(sha256(token)).toBe(row.tokenHash)
    await expect(
      teams.invite(TEAM, "new@example.org", "member", undefined, organiser)
    ).rejects.toMatchObject({ status: 409, code: "invite_already_pending" })
    await expect(
      teams.invite(TEAM, "mem@example.org", "member", undefined, organiser)
    ).rejects.toMatchObject({ status: 409, code: "already_member" })
    // Three seats: the organiser, the member and the open invite fill them.
    await expect(
      teams.invite(TEAM, "fourth@example.org", "member", undefined, organiser)
    ).rejects.toMatchObject({ status: 409, code: "no_seats" })
    await expect(
      teams.invite(
        TEAM,
        "x@example.org",
        "member",
        { libraryDocumentId: "libraryzzzzzzzzzzzzzzzz1", staffRole: "editor" },
        organiser
      )
    ).rejects.toMatchObject({ status: 400, code: "library_not_in_team" })
  })
  it("accepts a join link only for the invited email, within 14 days, then applies the pre-assignment", async () => {
    const token = randomBytes(32).toString("hex")
    const stale = randomBytes(32).toString("hex")
    const { teams, store } = setup(
      {},
      {
        [TEAM_MEMBER_UID]: [
          member(
            ORGANISER,
            "org",
            "org@example.org",
            "organiser",
            "active",
            team()
          ),
          member(
            INVITED,
            null,
            "new@example.org",
            "member",
            "invited",
            team(),
            {
              tokenHash: sha256(token),
              invitedAt: new Date(Date.now() - DAY).toISOString(),
              preassign: { libraryDocumentId: LIB_A, staffRole: "editor" },
            }
          ),
          member(
            "teammember00000000000004",
            null,
            "old@example.org",
            "member",
            "invited",
            team(),
            {
              tokenHash: sha256(stale),
              invitedAt: new Date(Date.now() - 15 * DAY).toISOString(),
            }
          ),
        ],
      }
    )
    expect(await teams.preview(token, "other@example.org")).toMatchObject({
      teamName: "Kent Libraries",
      emailMasked: "n•••@example.org",
      emailMatches: false,
      status: "open",
    })
    await expect(
      teams.accept(token, {
        id: "newbie",
        email: "other@example.org",
        name: "N",
      })
    ).rejects.toMatchObject({ status: 403, code: "email_mismatch" })
    await expect(
      teams.accept(stale, { id: "late", email: "old@example.org", name: "L" })
    ).rejects.toMatchObject({ status: 409, code: "invite_unavailable" })
    const summary = await teams.accept(token, {
      id: "newbie",
      email: " NEW@example.org ",
      name: "Nia",
    })
    expect(summary).toMatchObject({
      id: TEAM,
      role: "member",
      status: "active",
      verified: true,
      organiserName: "Name org",
      libraryDocumentIds: [LIB_A, LIB_B],
    })
    expect(
      store[TEAM_MEMBER_UID]!.find((r) => r.documentId === INVITED)
    ).toMatchObject({
      baUserId: "newbie",
      status: "active",
      tokenHash: null,
      acceptedAt: expect.any(String),
    })
    expect(store[AFFILIATION_UID]).toEqual([
      expect.objectContaining({
        baUserId: "newbie",
        source: "team",
        verificationMethod: "team",
        staffRole: "editor",
        library: { documentId: LIB_A },
        teamMember: { documentId: INVITED },
      }),
    ])
    expect(store[ROLE]).toEqual([
      expect.objectContaining({
        baUserId: "newbie",
        role: "verified_librarian",
        source: "team",
      }),
    ])
    // A used link is gone.
    await expect(
      teams.accept(token, {
        id: "newbie",
        email: "new@example.org",
        name: "Nia",
      })
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe("team assignments", () => {
  it("on a verified Team an assignment creates a team-sourced affiliation and grant at once", async () => {
    const { teams, store, services, strapi } = setup()
    const { result, member: view } = await teams.assign(
      TEAM,
      MEMBER,
      LIB_A,
      "editor",
      organiser
    )
    expect(result).toBe("assigned")
    expect(store[AFFILIATION_UID]).toEqual([
      expect.objectContaining({
        baUserId: "mem",
        source: "team",
        verificationMethod: "team",
        staffRole: "editor",
        approvedAt: expect.any(String),
        library: { documentId: LIB_A },
        teamMember: { documentId: MEMBER },
      }),
    ])
    expect(store[ROLE]).toEqual([
      expect.objectContaining({
        baUserId: "mem",
        role: "verified_librarian",
        source: "team",
      }),
    ])
    expect(view.assignments).toEqual([
      expect.objectContaining({
        libraryDocumentId: LIB_A,
        staffRole: "editor",
        canGoLive: true,
      }),
    ])
    expect(
      services["content-moderation.submission"].create
    ).not.toHaveBeenCalled()
    await expect(
      teams.assign(
        TEAM,
        MEMBER,
        "libraryzzzzzzzzzzzzzzzz1",
        "editor",
        organiser
      )
    ).rejects.toMatchObject({ status: 400, code: "library_not_in_team" })
    expect(await hasLibraryFeature(strapi, "mem", "library.team", LIB_A)).toBe(
      true
    )
  })
  it("on an unverified Team an assignment files a vouched Library Claim for a Moderator instead", async () => {
    const { teams, store, services } = setup({ verifiedAt: null })
    const { result, member: view } = await teams.assign(
      TEAM,
      MEMBER,
      LIB_A,
      "owner",
      organiser
    )
    expect(result).toBe("claim_filed")
    expect(
      services["content-moderation.submission"].create
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        submissionType: "library_claim",
        targetDocumentId: LIB_A,
        verificationMethod: "vouching",
        submittedByUserId: "mem",
        submittedByEmail: "mem@example.org",
        fields: expect.objectContaining({
          verificationMethod: "vouching",
          teamName: "Kent Libraries",
        }),
        draftData: {
          teamMemberDocumentId: MEMBER,
          teamDocumentId: TEAM,
          staffRole: "owner",
        },
      })
    )
    expect(store[AFFILIATION_UID]).toEqual([])
    expect(store[ROLE]).toEqual([])
    expect(view.pending).toEqual([
      expect.objectContaining({
        libraryDocumentId: LIB_A,
        staffRole: "owner",
        status: "pending",
      }),
    ])
    await expect(
      teams.assign(TEAM, MEMBER, LIB_A, "owner", organiser)
    ).rejects.toMatchObject({ status: 409, code: "claim_pending" })
    // Money never verifies: only an admin's `verify` flips it.
    await teams.verify(TEAM, true, 7)
    expect(store[TEAM_UID]![0]!.verifiedAt).toEqual(expect.any(String))
  })
  it("removing a member deletes only the Team-sourced affiliations and keeps the row as removed", async () => {
    const { teams, store } = setup(
      {},
      {
        [AFFILIATION_UID]: [
          {
            documentId: "affiliation0000000000001",
            baUserId: "mem",
            source: "team",
            staffRole: "editor",
            library: { documentId: LIB_A },
            teamMember: { documentId: MEMBER },
          },
          {
            documentId: "affiliation0000000000002",
            baUserId: "mem",
            source: "claim",
            staffRole: "owner",
            library: { documentId: LIB_B },
            teamMember: null,
          },
        ],
      }
    )
    await expect(
      teams.remove(TEAM, ORGANISER, organiser)
    ).rejects.toMatchObject({
      status: 409,
      code: "cannot_remove_self",
    })
    await expect(
      teams.remove(TEAM, ORGANISER, memberActor)
    ).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    })
    await teams.remove(TEAM, MEMBER, organiser)
    expect(store[AFFILIATION_UID]!.map((row) => row.documentId)).toEqual([
      "affiliation0000000000002",
    ])
    expect(
      store[TEAM_MEMBER_UID]!.find((r) => r.documentId === MEMBER)
    ).toMatchObject({
      status: "removed",
      removedAt: expect.any(String),
      tokenHash: null,
      preassign: null,
    })
    expect(await teams.listMine("mem")).toEqual([])
  })
  it("lapsing flips the status and nothing else; the Team's features switch off until it is active again", async () => {
    const { teams, store, strapi } = setup(
      {},
      {
        [AFFILIATION_UID]: [
          {
            documentId: "affiliation0000000000001",
            baUserId: "mem",
            source: "team",
            staffRole: "editor",
            library: { documentId: LIB_A },
            teamMember: { documentId: MEMBER },
          },
        ],
      }
    )
    expect(await hasLibraryFeature(strapi, "mem", "library.team", LIB_A)).toBe(
      true
    )
    const lapsed = await teams.lapse(TEAM, true, 7)
    expect(lapsed.status).toBe("lapsed")
    expect(store[TEAM_UID]![0]).toMatchObject({
      status: "lapsed",
      verifiedAt: expect.any(String),
    })
    expect(store[TEAM_MEMBER_UID]!.map((r) => r.status)).toEqual([
      "active",
      "active",
    ])
    expect(store[AFFILIATION_UID]).toHaveLength(1)
    expect(await teams.listMine("mem")).toEqual([
      expect.objectContaining({ id: TEAM, status: "lapsed" }),
    ])
    expect(await hasLibraryFeature(strapi, "mem", "library.team", LIB_A)).toBe(
      false
    )
    await teams.lapse(TEAM, false, 7)
    expect(await hasLibraryFeature(strapi, "mem", "library.team", LIB_A)).toBe(
      true
    )
  })
})

describe("who may organise", () => {
  it("lets only an organiser (or an admin) invite, assign and change roles; outsiders see nothing", async () => {
    const { teams } = setup()
    await expect(
      teams.invite(TEAM, "x@example.org", "member", undefined, memberActor)
    ).rejects.toMatchObject({ status: 403, code: "forbidden" })
    await expect(
      teams.assign(TEAM, MEMBER, LIB_A, "editor", memberActor)
    ).rejects.toMatchObject({ status: 403, code: "forbidden" })
    await expect(
      teams.setMember(TEAM, MEMBER, { teamRole: "organiser" }, memberActor)
    ).rejects.toMatchObject({ status: 403, code: "forbidden" })
    await expect(
      teams.requireOrganiser(TEAM, "stranger")
    ).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      teams.detail(TEAM, { baUserId: "stranger" })
    ).rejects.toMatchObject({
      status: 404,
    })
    // The last organiser can't step down.
    await expect(
      teams.setMember(TEAM, ORGANISER, { teamRole: "member" }, organiser)
    ).rejects.toMatchObject({ status: 409, code: "last_organiser" })
    const asMember = await teams.detail(TEAM, { baUserId: "mem" })
    expect(asMember.viewerRole).toBe("member")
    expect(asMember.members.map((m) => m.email)).toEqual(["", ""])
    expect(asMember.members.map((m) => m.emailMasked)).toEqual([
      "o•••@example.org",
      "m•••@example.org",
    ])
    expect(asMember.organiserNames).toEqual(["Name org"])
    const asOrganiser = await teams.detail(TEAM, { baUserId: "org" })
    expect(asOrganiser.viewerRole).toBe("organiser")
    expect(asOrganiser.members.map((m) => m.email)).toEqual([
      "org@example.org",
      "mem@example.org",
    ])
    expect(asOrganiser.notes).toBeNull()
    const promoted = await teams.setMember(
      TEAM,
      MEMBER,
      { teamRole: "organiser" },
      organiser
    )
    expect(promoted.teamRole).toBe("organiser")
  })
})
