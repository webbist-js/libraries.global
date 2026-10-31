import { facilityChecklistFor } from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi, materialiseRelations } from "./helpers/fake-strapi"
import lifecycles from "../src/api/library-affiliation/content-types/library-affiliation/lifecycles"
import createModerationController from "../src/plugins/content-moderation/server/controllers/moderation"
import createPolicy from "../src/plugins/content-moderation/server/services/submission-policy"
import factory, { AUDIT } from "../src/plugins/library-staff/server/service"
import { upsertAffiliation } from "../src/utils/affiliations"
import {
  deriveStaffRoles,
  listStaff,
  AFFILIATION_UID,
} from "../src/utils/staff"
import { onStaffChanged } from "../src/utils/staff-lifecycle"
import { TEAM_MEMBER_UID, TEAM_UID } from "../src/utils/team-access"

const LIBRARY = "api::library.library"
const ROLE = "api::role-grant.role-grant"
const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const library = {
  documentId: "library000000000000000001",
  name: "Central",
  slug: "central",
  libraryType: "Public",
  publishedAt: "2026-01-01T00:00:00.000Z",
}
const TEAM = "team00000000000000000001"
/** A valid Strapi documentId (20–32 lowercase alphanumerics) per user. */
const memberId = (user: string) => `member${user}`.padEnd(24, "0")
const affiliation = (
  user: string,
  staffRole: "owner" | "editor" | null,
  createdAt = "2026-01-01T00:00:00.000Z"
) => ({
  documentId: memberId(user),
  baUserId: user,
  staffRole,
  createdAt,
  approvedAt: createdAt,
  role: "Librarian",
  library,
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
    libraries: [{ documentId: library.documentId }],
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
function setup(
  members = [affiliation("owner", "owner"), affiliation("editor", "editor")],
  team = true
) {
  const fake = makeFakeStrapi({
    [LIBRARY]: [library],
    [AFFILIATION_UID]: members,
    [AUDIT]: [],
    ...(team ? teamRows("owner") : {}),
  })
  materialiseRelations(fake, "plugin::access.library-authority-grant", [
    "library",
  ])
  materialiseRelations(fake, AFFILIATION_UID, ["library", "teamMember"])
  const staff = factory({ strapi: fake.strapi })
  fake.services["library-staff.staff"] = staff
  fake.services["email.email"] = { send: vi.fn().mockResolvedValue({}) }
  fake.services["access.teams"] = {
    forLibrary: vi.fn().mockResolvedValue(null),
  }

  return { ...fake, staff }
}
afterEach(() => {
  vi.unstubAllEnvs()
  delete (globalThis as any).strapi
})

describe("library staff authority", () => {
  it("notifies the affected member after a permission change, but skips an unchanged value", async () => {
    const { staff, services } = setup()
    const enqueue = vi.fn().mockResolvedValue({})
    services["api::notification.notification"] = { enqueue }
    await staff.changeMember("owner", library.documentId, memberId("editor"), {
      canGoLive: false,
    })
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledOnce())
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        baUserId: "editor",
        kind: "staff_update",
        emailPreference: "transactional",
        href: "/staff/central/team",
      })
    )
    await staff.changeMember("owner", library.documentId, memberId("editor"), {
      canGoLive: false,
    })
    expect(enqueue).toHaveBeenCalledOnce()
  })
  it("derives the earliest approved claimant as owner only when no row carries a level", () => {
    const rows = [
      { staffRole: null, approvedAt: "2026-03-01" },
      { staffRole: null, approvedAt: "2026-01-01" },
    ]
    expect(deriveStaffRoles(rows).map((row) => row.staffRole)).toEqual([
      "editor",
      "owner",
    ])
    expect(rows.every((row) => row.staffRole === null)).toBe(true)
    // A stored owner is never demoted by an earlier null row (1.1).
    expect(
      deriveStaffRoles([
        { staffRole: "owner", approvedAt: "2026-03-01" },
        rows[1]!,
      ]).map((row) => row.staffRole)
    ).toEqual(["owner", "editor"])
  })
  it("stores the first claimant as owner explicitly and later claimants as editors", async () => {
    const fake = makeFakeStrapi({ [LIBRARY]: [library], [AFFILIATION_UID]: [] })
    materialiseRelations(fake, "plugin::access.library-authority-grant", [
      "library",
    ])
    materialiseRelations(fake, AFFILIATION_UID, ["library"])
    const { strapi, store } = fake
    await upsertAffiliation(strapi, {
      baUserId: "first",
      libraryDocumentId: library.documentId,
      role: "Librarian",
    })
    await upsertAffiliation(strapi, {
      baUserId: "second",
      libraryDocumentId: library.documentId,
      role: "Assistant",
    })
    expect(store[AFFILIATION_UID]!.map((row) => row.staffRole)).toEqual([
      "owner",
      "editor",
    ])
    expect(store[AFFILIATION_UID]![0]).toMatchObject({
      source: "claim",
      approvedAt: expect.any(String),
    })
    expect(
      (await listStaff(strapi, library.documentId)).map((row) => [
        row.baUserId,
        row.staffRole,
      ])
    ).toEqual([
      ["first", "owner"],
      ["second", "editor"],
    ])
  })
  it("promotes a proposer row to a claim with no job title, as the owner when the library had none (1.2)", async () => {
    const fake = makeFakeStrapi({
      [LIBRARY]: [library],
      [AFFILIATION_UID]: [
        {
          documentId: "proposer-row",
          baUserId: "proposer",
          role: "proposer",
          staffRole: null,
          library: { documentId: library.documentId },
        },
      ],
    })
    materialiseRelations(fake, "plugin::access.library-authority-grant", [
      "library",
    ])
    materialiseRelations(fake, AFFILIATION_UID, ["library"])
    const joined = vi.fn()
    fake.services["library-staff.staff"] = { joined }
    const { created } = await upsertAffiliation(fake.strapi, {
      baUserId: "proposer",
      libraryDocumentId: library.documentId,
    })
    expect(created).toBe(false)
    expect(fake.store[AFFILIATION_UID]![0]).toMatchObject({
      role: null,
      staffRole: "owner",
      approvedAt: expect.any(String),
    })
    expect(joined).toHaveBeenCalledWith("proposer", library.documentId)
    expect(await listStaff(fake.strapi, library.documentId)).toHaveLength(1)
  })
  it("excludes proposers and grants no access to an unrelated library", async () => {
    const { strapi, staff } = setup([
      { ...affiliation("proposer", null), role: "proposer" },
    ])
    expect(await listStaff(strapi, library.documentId)).toEqual([])
    await expect(
      staff.team("proposer", library.documentId)
    ).rejects.toMatchObject({ status: 404 })
    await expect(staff.team("owner", "another-library")).rejects.toMatchObject({
      status: 404,
    })
  })
  it("refuses editor management and needs a Team covering the library, never a personal plan", async () => {
    const { staff } = setup()
    await expect(
      staff.changeMember("editor", library.documentId, memberId("owner"), {
        staffRole: "editor",
      })
    ).rejects.toMatchObject({ status: 403 })
    const free = setup(undefined, false)
    free.store["api::entitlement-grant.entitlement-grant"] = [
      { documentId: "grant", baUserId: "owner", plan: "team", expiresAt: null },
    ]
    await expect(
      free.staff.changeMember("owner", library.documentId, memberId("editor"), {
        staffRole: "owner",
      })
    ).rejects.toMatchObject({ status: 402, code: "upgrade_required" })
    const view = await free.staff.team("owner", library.documentId)
    expect(view.covered).toBe(false)
    expect(
      view.members.every(
        (row: any) => row.staffRole === undefined && row.canGoLive === undefined
      )
    ).toBe(true)
    const covered = await staff.team("owner", library.documentId)
    expect(covered.covered).toBe(true)
    expect(covered.members.map((row: any) => row.staffRole)).toEqual([
      "owner",
      "editor",
    ])
  })
  it("keeps the last owner when leaving, removing or demoting", async () => {
    const { staff, store } = setup()
    for (const change of [
      () =>
        staff.changeMember("owner", library.documentId, "", {}, false, true),
      () =>
        staff.changeMember(
          "owner",
          library.documentId,
          memberId("owner"),
          {},
          true
        ),
      () =>
        staff.changeMember("owner", library.documentId, memberId("owner"), {
          staffRole: "editor",
        }),
    ]) {
      await expect(change()).rejects.toMatchObject({
        status: 409,
        code: "last_owner",
      })
    }
    expect(store[AFFILIATION_UID]).toHaveLength(2)
    expect(store[AUDIT]).toHaveLength(0)
  })
  it("lets an editor leave for free: the row goes, the audit is written, and the lifecycle does the rest", async () => {
    const { staff, store, services } = setup(undefined, false)
    services["mobile-libraries.live"] = { revokeFor: vi.fn() }
    await staff.changeMember("editor", library.documentId, "", {}, false, true)
    expect(store[AFFILIATION_UID]?.map((row) => row.baUserId)).toEqual([
      "owner",
    ])
    expect(store[AUDIT]?.[0]).toMatchObject({
      action: "left",
      subject: "editor",
    })
    // Membership effects belong to the affiliation lifecycle (2.1), so the
    // service itself revokes nothing.
    expect(services["mobile-libraries.live"].revokeFor).not.toHaveBeenCalled()
  })
  it("revokes live access from the lifecycle when a member is gone or may no longer go live", async () => {
    const { strapi, store, services } = setup([
      affiliation("owner", "owner"),
      { ...affiliation("editor", "editor"), canGoLive: false },
    ])
    services["mobile-libraries.live"] = { revokeFor: vi.fn() }
    await onStaffChanged(strapi, {
      libraryDocumentId: library.documentId,
      baUserId: "editor",
      change: "approved",
    })
    expect(services["mobile-libraries.live"].revokeFor).toHaveBeenCalledWith(
      "editor",
      library.documentId
    )
    expect(store[LIBRARY]![0]!.hasStaff).toBe(true)
    services["mobile-libraries.live"].revokeFor.mockClear()
    await onStaffChanged(strapi, {
      libraryDocumentId: library.documentId,
      baUserId: "owner",
      change: "approved",
    })
    expect(services["mobile-libraries.live"].revokeFor).not.toHaveBeenCalled()
  })
  it("the affiliation lifecycle fires once per person and library, mapping deletes to removed", async () => {
    const rows = [
      affiliation("editor", "editor"),
      { ...affiliation("editor", "editor"), documentId: memberId("editordup") },
      { ...affiliation("proposer", null), role: "proposer" },
    ]
    const fake = setup([affiliation("owner", "owner")])
    fake.services["mobile-libraries.live"] = { revokeFor: vi.fn() }
    ;(globalThis as any).strapi = fake.strapi
    const libraryWrites = () =>
      fake.strapi.db.query.mock.calls.filter(
        ([uid]: [string]) => uid === LIBRARY
      ).length
    await lifecycles.afterDeleteMany({
      action: "afterDeleteMany",
      params: {},
      state: { staffRows: rows },
    })
    expect(libraryWrites()).toBe(1)
    expect(
      fake.services["mobile-libraries.live"].revokeFor
    ).toHaveBeenCalledExactlyOnceWith("editor", library.documentId)
    // A create maps to "approved": hasStaff is refreshed, nothing is revoked.
    fake.services["mobile-libraries.live"].revokeFor.mockClear()
    fake.store[AFFILIATION_UID]!.push({
      ...affiliation("newbie", null),
      id: 77,
    })
    await lifecycles.afterCreate({
      action: "afterCreate",
      params: {},
      result: { id: 77 },
    })
    expect(libraryWrites()).toBe(2)
    expect(
      fake.services["mobile-libraries.live"].revokeFor
    ).not.toHaveBeenCalled()
    expect(fake.store[LIBRARY]![0]!.hasStaff).toBe(true)
  })
  it("expires claim- and team-sourced role grants after the last membership ends; admin grants stay", async () => {
    const { strapi, store } = makeFakeStrapi({
      [AFFILIATION_UID]: [],
      [LIBRARY]: [library],
      [ROLE]: [
        {
          documentId: "claim",
          baUserId: "owner",
          role: "verified_librarian",
          source: "claim",
          expiresAt: null,
        },
        {
          documentId: "team",
          baUserId: "owner",
          role: "verified_librarian",
          source: "team",
          expiresAt: null,
        },
        {
          documentId: "admin",
          baUserId: "owner",
          role: "moderator",
          queue: "all",
          source: "admin",
          expiresAt: null,
        },
      ],
      [PROFILE]: [
        {
          documentId: "profile",
          baUserId: "owner",
          contributorRole: "verified_librarian",
          isVerifiedLibrarian: true,
        },
      ],
    })
    await onStaffChanged(strapi, {
      libraryDocumentId: library.documentId,
      baUserId: "owner",
      change: "removed",
    })
    expect(store[ROLE]?.[0]?.expiresAt).toEqual(expect.any(String))
    expect(store[ROLE]?.[1]?.expiresAt).toEqual(expect.any(String))
    expect(store[ROLE]?.[2]?.expiresAt).toBeNull()
    expect(store[PROFILE]?.[0]).toMatchObject({
      contributorRole: "moderator",
      isVerifiedLibrarian: false,
    })
    expect(store[LIBRARY]?.[0]?.hasStaff).toBe(false)
  })
})

describe("staff overview", () => {
  it("reports the facility checklist as answered-of-total counts", async () => {
    const checks = facilityChecklistFor("Public")
    const { staff, store } = setup()
    Object.assign(store[LIBRARY]![0]!, {
      accessibility: [{ name: "Hearing loop" }],
      absentFacilities: ["Wi-Fi"],
    })
    const overview = await staff.overview("owner", library.documentId)
    const row = overview.health.find((h: any) => h.key === "accessibility")
    expect(row).toMatchObject({
      answered: 2,
      total: checks.length,
      note: `2 of ${checks.length} answered`,
      status: "todo",
    })
    expect(overview.role).toBe("owner")
    expect(overview.counts).toEqual({
      suggestions: 0,
      noticesUpcoming: 0,
      noticesActive: 0,
    })
    store[LIBRARY]![0]!.absentFacilities = checks.map((check) => check.label)
    const done = await staff.overview("owner", library.documentId)
    expect(
      done.health.find((h: any) => h.key === "accessibility")
    ).toMatchObject({
      answered: checks.length,
      status: "ok",
    })
  })
})

describe("Moderator staff removal", () => {
  const SECRET = "test-bridge-secret"
  const grant = (baUserId: string, queue: string) => ({
    documentId: `grant${baUserId}${queue}`.padEnd(24, "0"),
    baUserId,
    role: "moderator",
    queue,
    scopeLocale: null,
    expiresAt: null,
  })
  function moderation() {
    const fake = makeFakeStrapi({
      [LIBRARY]: [library],
      [AFFILIATION_UID]: [
        affiliation("owner", "owner"),
        affiliation("modindex", "editor"),
        { ...affiliation("proposer", null), role: "proposer" },
      ],
      [ROLE]: [grant("modindex", "index"), grant("modknowledge", "knowledge")],
      [SUBMISSION]: [],
    })
    fake.services["content-moderation.submission-policy"] = createPolicy({
      strapi: fake.strapi,
    })
    const audit = vi.fn()
    fake.services["library-staff.staff"] = { audit }
    vi.stubEnv("STRAPI_BRIDGE_SECRET", SECRET)
    const controller: any = createModerationController({ strapi: fake.strapi })
    const ctx = (viewer: string, affiliationDocumentId: string) => ({
      params: { affiliationDocumentId },
      request: {
        headers: {
          "x-service-secret": SECRET,
          "x-ba-session-created-at": new Date().toISOString(),
          "x-ba-user-id": viewer,
          "x-ba-user-email": `${viewer}@example.org`,
        },
      },
      status: 200,
      body: undefined as unknown,
      set: vi.fn(),
    })

    return { ...fake, controller, ctx, audit }
  }
  it("refuses a Moderator outside the index queue, and never the caller's own row", async () => {
    const { controller, ctx, store } = moderation()
    const knowledge = ctx("modknowledge", memberId("owner"))
    await controller.removeStaff(knowledge)
    expect(knowledge.status).toBe(403)
    const self = ctx("modindex", memberId("modindex"))
    await controller.removeStaff(self)
    expect(self.status).toBe(403)
    const proposer = ctx("modindex", memberId("proposer"))
    await controller.removeStaff(proposer)
    expect(proposer.status).toBe(404)
    expect(store[AFFILIATION_UID]).toHaveLength(3)
  })
  it("deletes the row through the Document Service and audits the removal", async () => {
    const { controller, ctx, store, audit } = moderation()
    const c = ctx("modindex", memberId("owner"))
    await controller.removeStaff(c)
    expect(c.status).toBe(200)
    expect(c.body).toEqual({ data: { removed: true } })
    expect(store[AFFILIATION_UID]!.map((row) => row.baUserId)).toEqual([
      "modindex",
      "proposer",
    ])
    expect(audit).toHaveBeenCalledWith(
      library.documentId,
      "modindex",
      "removed",
      "owner",
      { by: "moderator" }
    )
  })
})
