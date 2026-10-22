import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createTeams from "../../src/plugins/access/server/services/teams"
import { AFFILIATION_UID } from "../../src/utils/staff"
import { TEAM_MEMBER_UID, TEAM_UID } from "../../src/utils/team-access"
import { makeFakeStrapi, materialiseRelations } from "../helpers/fake-strapi"

/**
 * Invites without an email provider, the library named in the invite, and
 * `forLibrary` for staff outside the Team (the Team tab's "ask the
 * organiser" line) and for a library no Team covers.
 */

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"
const LIB_A = "libraryaaaaaaaaaaaaaaaa1"
const LIB_B = "librarybbbbbbbbbbbbbbbb1"
const LIB_C = "librarycccccccccccccccc1"
const TEAM = "team00000000000000000001"
const ORGANISER = "teammember00000000000001"
const MEMBER = "teammember00000000000002"
const INVITED = "teammember00000000000003"
const DAY = 86_400_000
const MAIL_ENV = [
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILTRAP_USER",
  "MAILTRAP_PASS",
]

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
const libC = {
  ...libA,
  documentId: LIB_C,
  name: "Library C",
  slug: "library-c",
}
const team = (over: Record<string, unknown> = {}) => ({
  documentId: TEAM,
  name: "Kent Libraries",
  slug: "kent-libraries",
  seats: 5,
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

function setup(
  teamOver: Record<string, unknown> = {},
  extraMembers: Record<string, unknown>[] = []
) {
  const t = team(teamOver)
  const fake = makeFakeStrapi({
    [LIBRARY]: [libA, libB, libC],
    [TEAM_UID]: [t],
    [TEAM_MEMBER_UID]: [
      member(ORGANISER, "org", "org@example.org", "organiser", "active", t),
      member(MEMBER, "mem", "mem@example.org", "member", "active", t),
      ...(extraMembers as any[]),
    ],
    [AFFILIATION_UID]: [],
    [SUBMISSION]: [],
  })
  materialiseRelations(fake, AFFILIATION_UID, ["library", "teamMember"])
  materialiseRelations(fake, TEAM_MEMBER_UID, ["team"])
  fake.services["access.people"] = {
    namesOf: vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, `Name ${id}`]))
    ),
  }
  fake.services["email.email"] = { send: vi.fn().mockResolvedValue({}) }
  const teams = createTeams({ strapi: fake.strapi })
  fake.services["access.teams"] = teams

  return { ...fake, teams, team: t }
}

const invitedRow = (store: Record<string, any[]>) =>
  store[TEAM_MEMBER_UID]!.find((r) => r.email === "new@example.org")

beforeEach(() => {
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.example")
  for (const key of MAIL_ENV) vi.stubEnv(key, "")
})
afterEach(() => vi.unstubAllEnvs())

describe("teams.invite and its email", () => {
  it("creates the invite and answers emailSent: false when no email provider is configured", async () => {
    const { teams, store, services, strapi } = setup()
    const result = await teams.invite(
      TEAM,
      "new@example.org",
      "member",
      { libraryDocumentId: LIB_A, staffRole: "editor" },
      organiser
    )

    expect(result.emailSent).toBe(false)
    expect(result.member).toMatchObject({
      status: "invited",
      emailMasked: "n•••@example.org",
      preassign: { libraryDocumentId: LIB_A, staffRole: "editor" },
    })
    const row = invitedRow(store)!
    expect(row).toMatchObject({ status: "invited", team: { documentId: TEAM } })
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(services["email.email"].send).not.toHaveBeenCalled()
    expect(strapi.log.info).toHaveBeenCalledWith(
      expect.stringContaining("no email provider configured")
    )
  })

  it("creates the invite and answers emailSent: false when no public URL is known either", async () => {
    vi.stubEnv("APP_PUBLIC_URL", "")
    vi.stubEnv("MAILGUN_API_KEY", "key")
    vi.stubEnv("MAILGUN_DOMAIN", "mg.example.org")
    const { teams, store, services, strapi } = setup()
    const result = await teams.invite(
      TEAM,
      "new@example.org",
      "member",
      undefined,
      organiser
    )

    expect(result.emailSent).toBe(false)
    expect(invitedRow(store)).toMatchObject({ status: "invited" })
    expect(services["email.email"].send).not.toHaveBeenCalled()
    expect(strapi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("APP_PUBLIC_URL is not set")
    )
  })

  it("links the invite at the request's origin when APP_PUBLIC_URL is unset", async () => {
    vi.stubEnv("APP_PUBLIC_URL", "")
    vi.stubEnv("MAILGUN_API_KEY", "key")
    vi.stubEnv("MAILGUN_DOMAIN", "mg.example.org")
    const { teams, services } = setup()
    const result = await teams.invite(
      TEAM,
      "new@example.org",
      "member",
      undefined,
      organiser,
      "https://staging.example"
    )

    expect(result.emailSent).toBe(true)
    const mail = services["email.email"].send.mock.calls[0]![0]
    expect(mail.text).toMatch(
      /https:\/\/staging\.example\/staff\/teams\/join\/[a-f0-9]{64}/
    )
  })

  it("names the pre-assigned library in the email when a provider is configured", async () => {
    vi.stubEnv("MAILGUN_API_KEY", "key")
    vi.stubEnv("MAILGUN_DOMAIN", "mg.example.org")
    const { teams, services } = setup()
    const withLibrary = await teams.invite(
      TEAM,
      "new@example.org",
      "member",
      { libraryDocumentId: LIB_A, staffRole: "editor" },
      organiser
    )
    expect(withLibrary.emailSent).toBe(true)
    const mail = services["email.email"].send.mock.calls[0]![0]
    expect(mail).toMatchObject({
      to: "new@example.org",
      subject: "Join Kent Libraries on Libraries Global",
    })
    expect(mail.text).toContain(
      "Olive Organiser invited you to join Kent Libraries."
    )
    expect(mail.text).toContain("You'll be given staff access to Library A.")
    expect(mail.text).toContain("https://libraries.example/staff/teams/join/")

    // The join page names the library and links its staff page by slug
    // (`preview.preassign.libraryName`, `librarySlug`).
    const token = (mail.text as string).match(/join\/([a-f0-9]{64})/)![1]!
    const preview = await teams.preview(token, "new@example.org")
    expect(preview.preassign).toEqual({
      libraryDocumentId: LIB_A,
      staffRole: "editor",
      libraryName: "Library A",
      librarySlug: "library-a",
    })

    const plain = await teams.invite(
      TEAM,
      "second@example.org",
      "organiser",
      undefined,
      organiser
    )
    expect(plain.emailSent).toBe(true)
    const second = services["email.email"].send.mock.calls[1]![0]
    expect(second.text).toContain("as an organiser.")
    expect(second.text).not.toContain("staff access to")
  })
})

describe("teams.forLibrary", () => {
  it("tells staff outside the Team who covers the library: its name and organiser only", async () => {
    const { teams } = setup()
    const covering = await teams.forLibrary(LIB_A, "outsider")

    expect(covering).toEqual({
      documentId: TEAM,
      name: "Kent Libraries",
      slug: "kent-libraries",
      verified: true,
      viewerIsMember: false,
      viewerIsOrganiser: false,
      organiserNames: ["Name org"],
      organiserName: "Name org",
      organiserEmailMasked: "o•••@example.org",
      invites: [],
    })
    expect(JSON.stringify(covering)).not.toContain("mem@example.org")
  })

  it("is null for a library no active Team covers", async () => {
    const { teams } = setup()
    expect(await teams.forLibrary(LIB_C, "outsider")).toBeNull()
    expect(await teams.forLibrary(LIB_C, "mem")).toBeNull()

    const lapsed = setup({ status: "lapsed" })
    expect(await lapsed.teams.forLibrary(LIB_A, "outsider")).toBeNull()

    const expired = setup({
      expiresAt: new Date(Date.now() - DAY).toISOString(),
    })
    expect(await expired.teams.forLibrary(LIB_A, "outsider")).toBeNull()
  })

  it("gives a member the full view, with only the invites pre-assigned to that library", async () => {
    const t = team()
    const { teams } = setup({}, [
      member(INVITED, null, "new@example.org", "member", "invited", t, {
        invitedAt: new Date(Date.now() - DAY).toISOString(),
        preassign: { libraryDocumentId: LIB_A, staffRole: "editor" },
      }),
      member(
        "teammember00000000000004",
        null,
        "late@example.org",
        "member",
        "invited",
        t,
        {
          invitedAt: new Date(Date.now() - 20 * DAY).toISOString(),
          preassign: { libraryDocumentId: LIB_A, staffRole: "owner" },
        }
      ),
      member(
        "teammember00000000000005",
        null,
        "elsewhere@example.org",
        "member",
        "invited",
        t,
        { preassign: { libraryDocumentId: LIB_B, staffRole: "editor" } }
      ),
    ])
    const mine = await teams.forLibrary(LIB_A, "mem")

    expect(mine).toMatchObject({
      documentId: TEAM,
      name: "Kent Libraries",
      verified: true,
      viewerIsMember: true,
      viewerIsOrganiser: false,
      organiserName: "Name org",
    })
    expect(mine!.invites).toEqual([
      expect.objectContaining({
        documentId: INVITED,
        emailMasked: "n•••@example.org",
        staffRole: "editor",
        status: "pending",
      }),
      expect.objectContaining({
        emailMasked: "l•••@example.org",
        staffRole: "owner",
        status: "expired",
      }),
    ])
    const asOrganiser = await teams.forLibrary(LIB_A, "org")
    expect(asOrganiser).toMatchObject({
      viewerIsMember: true,
      viewerIsOrganiser: true,
    })
  })
})
