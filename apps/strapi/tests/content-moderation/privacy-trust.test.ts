import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { syncDerivedRole } from "../../src/utils/role-grants"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const ROLE_GRANT = "api::role-grant.role-grant"
const AFF = "api::library-affiliation.library-affiliation"
const LIB = "api::library.library"

describe("public activity", () => {
  it("is empty for private profiles", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          username: "alice",
          baUserId: "u1",
          profileVisibility: "private",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          submittedByUserId: "u1",
          status: "approved",
          submissionType: "correction",
        },
      ],
    })
    expect(
      await createService({ strapi }).findPublicByUsername("alice")
    ).toEqual([])
  })
  it("hides rejected submissions", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          username: "bob",
          baUserId: "u2",
          profileVisibility: "public",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          submittedByUserId: "u2",
          status: "rejected",
          submissionType: "correction",
        },
        {
          documentId: "s2",
          submittedByUserId: "u2",
          status: "approved",
          submissionType: "correction",
        },
      ],
    })
    const out = await createService({ strapi }).findPublicByUsername("bob")
    expect(out.map((s: any) => s.documentId)).toEqual(["s2"])
  })
  it("shows approved submissions only, never ones still in review", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          username: "cara",
          baUserId: "u4",
          profileVisibility: "public",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          submittedByUserId: "u4",
          status: "pending",
          submissionType: "correction",
        },
        {
          documentId: "s2",
          submittedByUserId: "u4",
          status: "needs_info",
          submissionType: "correction",
        },
        {
          documentId: "s3",
          submittedByUserId: "u4",
          status: "draft",
          submissionType: "correction",
        },
        {
          documentId: "s4",
          submittedByUserId: "u4",
          status: "approved",
          submissionType: "correction",
        },
      ],
    })
    const out = await createService({ strapi }).findPublicByUsername("cara")
    expect(out.map((s: any) => s.documentId)).toEqual(["s4"])
  })
})

describe("claim approval", () => {
  it("never downgrades a wiki_editor", async () => {
    const claim: any = {
      documentId: "s0000000000000000000009",
      submissionType: "library_claim",
      status: "pending",
      submittedByUserId: "u3",
      targetDocumentId: "lib0000000000000000000001",
      fields: {},
    }
    claim.payloadHash = payloadHash(claim)
    const f = makeFakeStrapi({
      [SUB]: [claim],
      [PROFILE]: [
        { documentId: "p3", baUserId: "u3", contributorRole: "wiki_editor" },
      ],
      [ROLE_GRANT]: [
        {
          documentId: "rg1",
          baUserId: "u3",
          role: "wiki_editor",
          queue: "all",
          scopeLocale: null,
        },
      ],
      [LIB]: [{ documentId: "lib0000000000000000000001", id: 7 }],
      [AFF]: [],
    })
    f.services["rewards.points"] = {
      award: vi.fn(async () => ({ awarded: true })),
    }
    f.services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }
    await createService({ strapi: f.strapi }).updateStatus(
      "s0000000000000000000009",
      "approved",
      REVIEWER
    )
    // Approval adds a claim grant and keeps the editor grant; the lifecycle
    // (run by hand here) derives the profile from both.
    expect(f.store[ROLE_GRANT].map((g: any) => [g.role, g.source])).toEqual([
      ["wiki_editor", undefined],
      ["verified_librarian", "claim"],
    ])
    await syncDerivedRole(f.strapi, "u3")
    expect(f.store[PROFILE][0].contributorRole).toBe("wiki_editor")
    expect(f.store[PROFILE][0].isVerifiedLibrarian).toBe(true)
    expect(f.store[AFF]).toHaveLength(1)
  })

  it("upserts an existing affiliation by library documentId instead of duplicating it", async () => {
    const claim: any = {
      documentId: "s0000000000000000000010",
      submissionType: "library_claim",
      status: "pending",
      submittedByUserId: "u3",
      targetDocumentId: "lib0000000000000000000001",
      fields: {},
    }
    claim.payloadHash = payloadHash(claim)
    const f = makeFakeStrapi({
      [SUB]: [claim],
      [PROFILE]: [{ documentId: "p3", baUserId: "u3" }],
      [LIB]: [{ documentId: "lib0000000000000000000001", id: 7 }],
      [AFF]: [
        {
          documentId: "aff1",
          baUserId: "u3",
          library: { documentId: "lib0000000000000000000001" },
          role: "librarian",
        },
      ],
    })
    f.services["rewards.points"] = {
      award: vi.fn(async () => ({ awarded: true })),
    }
    f.services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }
    await createService({ strapi: f.strapi }).updateStatus(
      "s0000000000000000000010",
      "approved",
      REVIEWER
    )
    expect(f.store[AFF]).toHaveLength(1)
    expect(f.store[AFF][0].role).toBe("librarian")
  })
})
