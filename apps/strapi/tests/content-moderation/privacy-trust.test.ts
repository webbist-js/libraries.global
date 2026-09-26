import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
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
      "admin"
    )
    expect(f.store[PROFILE][0].contributorRole).toBe("wiki_editor")
    expect(f.store[PROFILE][0].isVerifiedLibrarian).toBe(true)
    expect(f.store[AFF]).toHaveLength(1)
  })
})
