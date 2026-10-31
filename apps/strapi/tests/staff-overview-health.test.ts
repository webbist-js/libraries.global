import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory, { AUDIT } from "../src/plugins/library-staff/server/service"
import { LIBRARY_NOTICE_UID } from "../src/utils/library-notices"
import { AFFILIATION_UID } from "../src/utils/staff"
import { TEAM_MEMBER_UID, TEAM_UID } from "../src/utils/team-access"

/**
 * The Staff area overview's health rows (where each "Finish" link goes,
 * and a Mobile library's timetable row), the Team tab's covering Team for
 * staff outside it, and the access report's link for the Moderators.
 */

const LIBRARY = "api::library.library"
const ID = "library000000000000000001"
const TEAM = "team00000000000000000001"
const library = () => ({
  documentId: ID,
  name: "Central",
  slug: "central",
  libraryType: "Public",
  publishedAt: "2026-01-01T00:00:00.000Z",
  continent: { slug: "europe" },
  country: { slug: "united-kingdom" },
  region: { slug: "england" },
})
const timetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "stop000001",
      name: "First stop",
      where: "",
      location: { lat: 51, lng: 0 },
      areaDocumentId: null,
    },
    {
      id: "stop000002",
      name: "Last stop",
      where: "",
      location: { lat: 51.01, lng: 0.01 },
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "tue",
      arrive: "09:30",
      depart: "10:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const affiliation = (
  user: string,
  staffRole: "owner" | "editor",
  createdAt = "2026-01-01T00:00:00.000Z"
) => ({
  documentId: `member${user}`.padEnd(24, "0"),
  baUserId: user,
  staffRole,
  createdAt,
  approvedAt: createdAt,
  role: "Librarian",
  library: { documentId: ID },
})
/** An active, verified Team covering the library, with `user` as a member. */
const teamRows = (user: string) => {
  const team = {
    documentId: TEAM,
    name: "Central Libraries",
    slug: "central-libraries",
    seats: 5,
    status: "active",
    verifiedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    libraries: [{ documentId: ID }],
  }

  return {
    [TEAM_UID]: [team],
    [TEAM_MEMBER_UID]: [
      {
        documentId: "teammember00000000000001",
        baUserId: user,
        email: `${user}@example.org`,
        teamRole: "member",
        status: "active",
        team,
      },
    ],
  }
}

function setup(covered = false) {
  const fake = makeFakeStrapi({
    [LIBRARY]: [library()],
    [AFFILIATION_UID]: [
      affiliation("owner", "owner"),
      affiliation("editor", "editor", "2026-01-02T00:00:00.000Z"),
    ],
    [AUDIT]: [],
    ...(covered ? teamRows("owner") : {}),
  })
  const staff = factory({ strapi: fake.strapi })
  fake.services["library-staff.staff"] = staff
  fake.services["email.email"] = { send: vi.fn().mockResolvedValue({}) }
  fake.services["access.teams"] = {
    forLibrary: vi.fn().mockResolvedValue(null),
  }

  return { ...fake, staff }
}
const rowOf = (overview: any, key: string) =>
  overview.health.find((h: any) => h.key === key)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("staff overview health rows", () => {
  it("returns stored completeness and counts showing-now notices in the library's timezone", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-07T23:30:00Z"))
    const { staff, store } = setup()
    Object.assign(store[LIBRARY]![0]!, {
      timezone: "Asia/Tokyo",
      completeness: 88,
    })
    const notice = (
      id: string,
      from: string,
      to: string | null,
      endedAt: string | null = null
    ) => ({
      documentId: id,
      library: { documentId: ID },
      type: "service",
      scope: "library",
      message: "Library notice",
      from,
      to,
      endedAt,
    })
    store[LIBRARY_NOTICE_UID] = [
      notice("today", "2026-10-08", "2026-10-08"),
      notice("open-ended", "2026-10-01", null),
      notice("tomorrow", "2026-10-09", "2026-10-09"),
      notice("later", "2026-10-23", "2026-10-23"),
      notice("expired", "2026-10-06", "2026-10-07"),
      notice("ended", "2026-10-08", "2026-10-10", "2026-10-07T23:00:00Z"),
    ]

    const overview = await staff.overview("editor", ID)
    expect(overview.library.completeness).toBe(88)
    expect(overview.counts).toMatchObject({
      noticesActive: 2,
      noticesUpcoming: 1,
    })

    delete store[LIBRARY]![0]!.completeness
    expect((await staff.overview("editor", ID)).library.completeness).toBeNull()
  })

  it("sends the catalogue link to the wizard's links group and the events feed to Connect", async () => {
    const { staff, store } = setup()
    const todo = await staff.overview("owner", ID)

    expect(rowOf(todo, "hours")).toMatchObject({
      label: "Opening hours",
      status: "todo",
      action: { label: "Add times", href: `/staff/central/edit?step=3` },
    })
    expect(rowOf(todo, "catalogue")).toMatchObject({
      status: "todo",
      note: "Not added",
      action: { label: "Add link", href: `/staff/central/edit?step=links` },
    })
    expect(rowOf(todo, "feed")).toMatchObject({
      status: "todo",
      note: "Not connected",
      action: { label: "Connect", href: `/staff/central/events/connect` },
    })
    expect(rowOf(todo, "photo").action.href).toBe(`/staff/central/edit?step=6`)

    Object.assign(store[LIBRARY]![0]!, {
      catalogueUrl: "https://catalogue.example",
      hasActiveFeed: true,
      heroImage: { url: "/uploads/x.jpg" },
    })
    const done = await staff.overview("owner", ID)
    expect(rowOf(done, "catalogue")).toMatchObject({
      status: "ok",
      note: "Added",
    })
    expect(rowOf(done, "feed")).toMatchObject({
      status: "ok",
      note: "Connected",
      action: { label: "Manage", href: `/staff/central/events` },
    })
    expect(rowOf(done, "photo")).toMatchObject({ status: "ok" })
    expect(done.library.path).toBe("/europe/united-kingdom/england/central")
  })

  it("a Mobile library's hours row is its timetable: done once stops exist, and no events feed row", async () => {
    const { staff, store } = setup()
    Object.assign(store[LIBRARY]![0]!, {
      libraryType: "Mobile",
      mobileTimetable: null,
    })
    const empty = await staff.overview("owner", ID)
    expect(rowOf(empty, "hours")).toMatchObject({
      label: "Timetable",
      status: "todo",
      note: "No stops yet",
      action: {
        label: "Add stops",
        href: `/staff/central/edit?step=timetable`,
      },
    })
    expect(rowOf(empty, "feed")).toBeUndefined()
    expect(rowOf(empty, "accessibility").label).toBe("Vehicle details")
    expect(rowOf(empty, "accessibility").action.href).toBe(
      `/staff/central/edit?step=access`
    )
    expect(rowOf(empty, "catalogue").action.href).toBe(
      `/staff/central/edit?step=links`
    )

    store[LIBRARY]![0]!.mobileTimetable = timetable
    const stops = await staff.overview("owner", ID)
    expect(rowOf(stops, "hours")).toMatchObject({
      status: "ok",
      note: "2 stops · not confirmed yet",
      action: {
        label: "Confirm times",
        href: `/staff/central/edit?step=timetable`,
      },
    })

    store[LIBRARY]![0]!.verifiedSections = {
      hours: "2026-10-01T09:00:00.000Z",
    }
    const checked = await staff.overview("owner", ID)
    expect(rowOf(checked, "hours")).toMatchObject({
      status: "ok",
      note: "2 stops · checked 2026-10-01",
      action: { label: "Still right" },
    })
  })
})

describe("staff team tab", () => {
  it("names the covering Team's organiser for staff outside it, and nothing else", async () => {
    const { staff, services } = setup()
    services["access.teams"].forLibrary.mockResolvedValue({
      documentId: TEAM,
      name: "Central Libraries",
      slug: "central-libraries",
      verified: true,
      viewerIsMember: false,
      viewerIsOrganiser: false,
      organiserNames: ["Olive Organiser"],
      organiserName: "Olive Organiser",
      organiserEmailMasked: "o•••@example.org",
      invites: [],
    })
    const tab = await staff.team("editor", ID)

    expect(services["access.teams"].forLibrary).toHaveBeenCalledWith(
      ID,
      "editor"
    )
    expect(tab.coveringTeam).toEqual({
      id: TEAM,
      name: "Central Libraries",
      organiserName: "Olive Organiser",
      organiserEmailMasked: "o•••@example.org",
      viewerIsMember: false,
    })
    expect(tab.team).toBeNull()
    expect(tab.covered).toBe(false)
    expect(tab.invites).toEqual([])
    // Uncovered: names only, no levels or dates.
    expect(tab.members.map((m: any) => Object.keys(m).sort())).toEqual([
      ["affiliationDocumentId", "initials", "isYou", "name"],
      ["affiliationDocumentId", "initials", "isYou", "name"],
    ])
  })

  it("shows a member their Team and its invites here, with no covering Team line", async () => {
    const { staff, services } = setup(true)
    services["access.teams"].forLibrary.mockResolvedValue({
      documentId: TEAM,
      name: "Central Libraries",
      slug: "central-libraries",
      verified: true,
      viewerIsMember: true,
      viewerIsOrganiser: true,
      organiserNames: ["Olive Organiser"],
      organiserName: "Olive Organiser",
      organiserEmailMasked: "o•••@example.org",
      invites: [
        {
          documentId: "teammember00000000000009",
          emailMasked: "n•••@example.org",
          staffRole: "editor",
          status: "pending",
          expiresAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    })
    const tab = await staff.team("owner", ID)

    expect(tab.coveringTeam).toBeNull()
    expect(tab.covered).toBe(true)
    expect(tab.team).toEqual({
      documentId: TEAM,
      name: "Central Libraries",
      verified: true,
      viewerIsOrganiser: true,
      organiserNames: ["Olive Organiser"],
    })
    expect(tab.invites).toHaveLength(1)
    expect(tab.members[0]).toMatchObject({ staffRole: "owner", isYou: true })
  })

  it("no Team at all: neither a covering Team nor a Team", async () => {
    const { staff } = setup()
    const tab = await staff.team("owner", ID)

    expect(tab.coveringTeam).toBeNull()
    expect(tab.team).toBeNull()
    expect(tab.canLeave).toBe(false)
  })
})

describe("staff access report", () => {
  it("links the Moderators to the library's staff list on the site", async () => {
    vi.stubEnv("MAILTRAP_USER", "fixture")
    vi.stubEnv("MAILTRAP_PASS", "fixture")
    vi.stubEnv("MODERATORS_EMAIL", "mods@example.org")
    vi.stubEnv("APP_PUBLIC_URL", "https://libraries.example")
    const { staff, services, store } = setup()
    await staff.report(
      "owner",
      ID,
      "Someone I don't recognise has joined our staff list."
    )

    expect(services["email.email"].send).toHaveBeenCalledTimes(1)
    const mail = services["email.email"].send.mock.calls[0]![0]
    expect(mail.to).toBe("mods@example.org")
    expect(mail.subject).toBe("Staff access report: Central")
    expect(mail.text).toContain(
      `https://libraries.example/moderation/staff/${ID}`
    )
    expect(store[AUDIT]![0]).toMatchObject({
      actor: "owner",
      action: "access_reported",
    })
  })

  it("is 503 without a Moderators address, and 400 for a message too short", async () => {
    vi.stubEnv("MODERATORS_EMAIL", "")
    const { staff } = setup()
    await expect(
      staff.report("owner", ID, "Someone I don't recognise has joined.")
    ).rejects.toMatchObject({ status: 503 })
    vi.stubEnv("MAILTRAP_USER", "fixture")
    vi.stubEnv("MAILTRAP_PASS", "fixture")
    vi.stubEnv("MODERATORS_EMAIL", "mods@example.org")
    await expect(staff.report("owner", ID, "short")).rejects.toMatchObject({
      status: 400,
    })
  })
})
