import { afterEach, describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/content-moderation/server/controllers/submission"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { resolveStaffLibraryCreation } from "../../src/plugins/content-moderation/server/utils/staff-library-creation"
import { AFFILIATION_UID } from "../../src/utils/staff"
import {
  MAX_TEAM_LIBRARIES,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../../src/utils/team-access"
import { makeFakeStrapi, materialiseRelations } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const LIB = "api::library.library"
const ROLE = "api::role-grant.role-grant"
const LIB_ID = "libraryaaaaaaaaaaaaaaaa1"
const TEAM_ID = "team00000000000000000001"
const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })
const context = { teamDocumentId: TEAM_ID, teamName: "County Libraries" }
const library = { documentId: LIB_ID, name: "Original Library" }
const team = {
  documentId: TEAM_ID,
  name: context.teamName,
  status: "active",
  expiresAt: null,
  verifiedAt: "2026-01-01",
  libraries: [library],
  seats: 4,
}
const affiliation = {
  documentId: "aff1",
  baUserId: "u1",
  role: null,
  staffRole: "owner",
  source: "claim",
  library,
  approvedAt: "2026-01-01",
  createdAt: "2026-01-01",
}
const membership = {
  documentId: "member1",
  baUserId: "u1",
  status: "active",
  teamRole: "member",
  team,
}
afterEach(() => vi.unstubAllEnvs())

function setup(extra: Record<string, any[]> = {}) {
  const fake = makeFakeStrapi({
    [LIB]: [library],
    [AFFILIATION_UID]: [affiliation],
    [TEAM_UID]: [team],
    [TEAM_MEMBER_UID]: [membership],
    [SUB]: [],
    [ROLE]: [],
    ...extra,
  })
  materialiseRelations(fake, AFFILIATION_UID, ["library"])
  fake.services["rewards.points"] = { award: vi.fn(async () => {}) }
  fake.services["i18n.locales"] = { find: async () => [{ code: "en" }] }

  return { ...fake, svc: createService({ strapi: fake.strapi }) }
}
const proposal = (
  staffCreation?: typeof context | { teamDocumentId: null; teamName: null }
) => {
  const sub = {
    documentId: "s0000000000000000000011",
    submissionType: "new_library",
    status: "pending",
    submittedByUserId: "u1",
    fields: { name: "New Library" },
    draftData: staffCreation ? { staffCreation } : null,
  }

  return { ...sub, payloadHash: payloadHash(sub as any) }
}

describe("authenticated staff creation endpoint", () => {
  const request = (staffCreation: unknown) => ({
    request: {
      body: {
        submissionType: "new_library",
        asDraft: true,
        fields: { name: "New Library" },
        staffCreation,
      },
      headers: {
        "x-service-secret": "test-secret",
        "x-ba-user-id": "u1",
        "x-ba-user-email": "u1@example.org",
      },
    },
    state: {},
    unauthorized: vi.fn(),
    badRequest: vi.fn(),
    set: vi.fn(),
    body: undefined as any,
    status: 200,
  })
  const controller = (extra: Record<string, any[]> = {}) => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    const fake = setup(extra)
    fake.services["content-moderation.submission"] = fake.svc
    fake.services["content-moderation.submission-policy"] = {
      check: async () => ({ ok: true }),
      checkContent: async () => ({ ok: true }),
    }

    return { ...fake, controller: createController({ strapi: fake.strapi }) }
  }
  it("refuses a client staff flag when the creator has no actual staff access", async () => {
    const fake = controller({ [AFFILIATION_UID]: [], [TEAM_MEMBER_UID]: [] })
    const ctx = request({ teamDocumentId: null })
    await fake.controller.create(ctx)
    expect(ctx.status).toBe(403)
    expect(fake.store[SUB]).toHaveLength(0)
  })
  it("stores only validated Team identity and its server name", async () => {
    const fake = controller()
    const ctx = request({ teamDocumentId: TEAM_ID, teamName: "Forged" })
    await fake.controller.create(ctx)
    expect(ctx.body.data.draftData).toMatchObject({ staffCreation: context })
    expect(fake.store[AFFILIATION_UID]).toHaveLength(1)
    expect(fake.store[TEAM_UID][0].libraries).toEqual([library])
  })
})

describe("staff library creation access", () => {
  it("requires a real staff claim or a verified active Team, not a proposer affiliation", async () => {
    const { strapi } = setup({
      [AFFILIATION_UID]: [{ ...affiliation, role: "proposer" }],
      [TEAM_MEMBER_UID]: [],
    })
    await expect(
      resolveStaffLibraryCreation(strapi, "u1", { teamDocumentId: null })
    ).rejects.toMatchObject({ status: 403, code: "staff_access_required" })
  })
  it("permits existing staff to create without paid coverage", async () => {
    const { strapi } = setup({ [TEAM_MEMBER_UID]: [] })
    expect(
      await resolveStaffLibraryCreation(strapi, "u1", { teamDocumentId: null })
    ).toEqual({ teamDocumentId: null, teamName: null })
  })
  it("permits members of a verified Team to request their first library", async () => {
    const { strapi } = setup({ [AFFILIATION_UID]: [] })
    expect(
      await resolveStaffLibraryCreation(strapi, "u1", {
        teamDocumentId: TEAM_ID,
        teamName: "forged",
      })
    ).toEqual(context)
  })
  it("refuses unverified Teams for someone with no staff access", async () => {
    const { strapi } = setup({
      [AFFILIATION_UID]: [],
      [TEAM_MEMBER_UID]: [
        { ...membership, team: { ...team, verifiedAt: null } },
      ],
    })
    await expect(
      resolveStaffLibraryCreation(strapi, "u1", context)
    ).rejects.toMatchObject({ code: "staff_access_required" })
  })
  it.each([
    { ...membership, status: "removed" },
    { ...membership, team: { ...team, status: "lapsed" } },
    { ...membership, team: { ...team, expiresAt: "2000-01-01" } },
    { ...membership, baUserId: "another-user" },
  ])("refuses coverage without current active membership", async (member) => {
    const { strapi } = setup({ [TEAM_MEMBER_UID]: [member] })
    await expect(
      resolveStaffLibraryCreation(strapi, "u1", context)
    ).rejects.toMatchObject({ code: "team_membership_required" })
  })
  it("enforces the Team library limit", async () => {
    const { strapi } = setup({
      [TEAM_MEMBER_UID]: [
        {
          ...membership,
          team: {
            ...team,
            libraries: Array.from({ length: MAX_TEAM_LIBRARIES }, (_, i) => ({
              documentId: `library${i}`,
            })),
          },
        },
      ],
    })
    await expect(
      resolveStaffLibraryCreation(strapi, "u1", context)
    ).rejects.toMatchObject({ status: 409, code: "team_library_limit" })
  })
})

describe("server-owned staff creation intent", () => {
  it("ignores a marker injected into an ordinary draft", async () => {
    const { svc, store } = setup()
    const draft = await svc.create({
      submissionType: "new_library",
      submittedByUserId: "u1",
      asDraft: true,
      notify: false,
      fields: { name: "Library" },
      draftData: { name: "Library", staffCreation: context },
    })
    await svc.saveDraft(
      draft.documentId,
      "u1",
      { name: "Changed", staffCreation: context },
      1
    )
    await svc.finalizeDraft(draft.documentId, "u1", {
      name: "Final",
      staffCreation: context,
    })
    expect(store[SUB][0].draftData).not.toHaveProperty("staffCreation")
    expect(store[SUB][0].fields).not.toHaveProperty("staffCreation")
  })
  it("preserves validated coverage across draft saves and finalization", async () => {
    const { svc, store } = setup()
    const draft = await svc.create({
      submissionType: "new_library",
      submittedByUserId: "u1",
      asDraft: true,
      notify: false,
      fields: { name: "Library" },
      draftData: { name: "Library" },
      staffCreation: context,
    })
    await svc.saveDraft(
      draft.documentId,
      "u1",
      { name: "Changed", staffCreation: { teamDocumentId: null } },
      2
    )
    expect(store[SUB][0].draftData).toMatchObject({
      name: "Changed",
      staffCreation: context,
    })
    await svc.finalizeDraft(draft.documentId, "u1", {
      name: "Final",
      staffCreation: { teamDocumentId: null },
    })
    expect(store[SUB][0]).toMatchObject({
      status: "pending",
      fields: { name: "Final" },
      draftData: { staffCreation: context },
    })
    expect(store[SUB][0].fields).not.toHaveProperty("staffCreation")
  })
  it("resumes ordinary and staff creation drafts separately", async () => {
    const ordinary = {
      ...proposal(),
      documentId: "ordinary",
      status: "draft",
      updatedAt: "2026-01-02",
    }
    const staff = {
      ...proposal(context),
      documentId: "staff",
      status: "draft",
      updatedAt: "2026-01-01",
    }
    const { svc } = setup({ [SUB]: [ordinary, staff] })
    expect(
      await svc.findDraft("u1", "new_library", undefined, "en", true)
    ).toMatchObject({ documentId: "staff" })
    expect(
      await svc.findDraft("u1", "new_library", undefined, "en", false)
    ).toMatchObject({ documentId: "ordinary" })
  })
})

describe("approval applies staff ownership and existing Team coverage atomically", () => {
  it("keeps ordinary creation as a proposer with no staff grant", async () => {
    const sub = proposal()
    const { svc, store } = setup({ [SUB]: [sub] })
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    expect(result).toMatchObject({ data: { status: "approved" } })
    expect(store[AFFILIATION_UID].at(-1)).toMatchObject({
      role: "proposer",
      staffRole: null,
    })
    expect(store[ROLE]).toHaveLength(0)
  })
  it("makes a staff creator the new library's owner without a Team", async () => {
    const sub = proposal({ teamDocumentId: null, teamName: null })
    const { svc, store } = setup({ [SUB]: [sub] })
    expect(
      await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toMatchObject({ data: { status: "approved" } })
    expect(store[AFFILIATION_UID].at(-1)).toMatchObject({
      baUserId: "u1",
      staffRole: "owner",
      source: "claim",
    })
    expect(store[AFFILIATION_UID].at(-1)?.library.documentId).toBe(
      store[LIB].at(-1)?.documentId
    )
    expect(store[ROLE].at(-1)).toMatchObject({
      role: "verified_librarian",
      source: "claim",
    })
    expect(store[TEAM_UID][0].libraries).toEqual([library])
  })
  it("connects coverage additively, without altering billing or seats", async () => {
    const sub = proposal(context)
    const { svc, strapi, store } = setup({ [SUB]: [sub] })
    const writes: any[] = []
    const docs = strapi.documents
    strapi.documents = (uid: string) => {
      const api = docs(uid)

      return uid === TEAM_UID
        ? {
            ...api,
            update: async (args: any) => {
              writes.push(args)

              return api.update(args)
            },
          }
        : api
    }
    expect(
      await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toMatchObject({ data: { status: "approved" } })
    expect(writes).toEqual([
      {
        documentId: TEAM_ID,
        data: {
          libraries: {
            connect: [{ documentId: store[LIB].at(-1)?.documentId }],
          },
        },
      },
    ])
    expect(store[TEAM_UID][0]).toMatchObject({
      seats: 4,
      status: "active",
      expiresAt: null,
      verifiedAt: "2026-01-01",
    })
    expect(store[AFFILIATION_UID].at(-1)).toMatchObject({ staffRole: "owner" })
  })
  it("rechecks membership at approval and leaves the submission pending if access was removed", async () => {
    const sub = proposal(context)
    const { svc, store } = setup({ [SUB]: [sub], [TEAM_MEMBER_UID]: [] })
    expect(
      await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toEqual({ error: "apply_failed" })
    expect(store[LIB]).toEqual([library])
    expect(store[AFFILIATION_UID]).toHaveLength(1)
    expect(store[TEAM_UID][0].libraries).toEqual([library])
    expect(store[SUB][0].status).toBe("pending")
  })
  it("rolls back coverage and the new record when granting ownership fails", async () => {
    const sub = proposal(context)
    const { svc, strapi, store } = setup({ [SUB]: [sub] })
    const docs = strapi.documents
    strapi.documents = (uid: string) => {
      const api = docs(uid)

      return uid === ROLE
        ? {
            ...api,
            create: async () => {
              throw new Error("db down")
            },
          }
        : api
    }
    expect(
      await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toEqual({ error: "apply_failed" })
    expect(store[LIB]).toEqual([library])
    expect(store[AFFILIATION_UID]).toHaveLength(1)
    expect(store[TEAM_UID][0].libraries).toEqual([library])
    expect(store[SUB][0].status).toBe("pending")
  })
})
