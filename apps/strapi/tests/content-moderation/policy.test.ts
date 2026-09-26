import { describe, expect, it } from "vitest"

import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const SUB = "plugin::content-moderation.submission"

function setup(role = "reader", claims: string[] = [], pending = 0) {
  const { strapi } = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "p0000000000000000000001",
        baUserId: "u1",
        contributorRole: role,
        tier: "Reader",
      },
    ],
    [AFF]: claims.map((lib, i) => ({
      documentId: `a${i}`,
      baUserId: "u1",
      library: { documentId: lib },
    })),
    [SUB]: Array.from({ length: pending }, (_, i) => ({
      documentId: `s${i}`,
      submittedByUserId: "u1",
      status: "pending",
    })),
  })

  return createPolicy({ strapi })
}

describe("submission policy", () => {
  it("rejects unknown types", async () => {
    expect(
      await setup().check({ baUserId: "u1", submissionType: "evil" })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it("blocks direct wiki edits for readers", async () => {
    expect(
      await setup().check({
        baUserId: "u1",
        submissionType: "wiki_edit",
        directWikiEdit: true,
      })
    ).toMatchObject({ ok: false, status: 403 })
  })
  it("allows direct wiki edits for wiki_editor", async () => {
    expect(
      await setup("wiki_editor").check({
        baUserId: "u1",
        submissionType: "wiki_edit",
        directWikiEdit: true,
      })
    ).toEqual({ ok: true })
  })
  it("requires a claim for library_edit", async () => {
    expect(
      await setup("verified_librarian", ["lib0000000000000000000001"]).check({
        baUserId: "u1",
        submissionType: "library_edit",
        targetDocumentId: "lib0000000000000000000002",
      })
    ).toMatchObject({ ok: false, status: 403 })
    expect(
      await setup("verified_librarian", ["lib0000000000000000000001"]).check({
        baUserId: "u1",
        submissionType: "library_edit",
        targetDocumentId: "lib0000000000000000000001",
      })
    ).toEqual({ ok: true })
  })
  it("rejects unknown verification methods", async () => {
    expect(
      await setup().check({
        baUserId: "u1",
        submissionType: "library_claim",
        verificationMethod: "trust_me",
      })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it("enforces the tier pending quota", async () => {
    expect(
      await setup("reader", [], 5).check({
        baUserId: "u1",
        submissionType: "correction",
      })
    ).toMatchObject({ ok: false, status: 429 })
  })
  it("gives editorial staff Curator quotas on a Reader tier", async () => {
    expect(
      await setup("wiki_editor", [], 5).check({
        baUserId: "u1",
        submissionType: "wiki_edit",
      })
    ).toEqual({ ok: true })
  })
  it("ignores plan fields on the profile (invariant 3)", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p0000000000000000000001",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
          plan: "pro",
          planSource: "paid",
        },
      ],
    })
    const verdict = await createPolicy({ strapi }).check({
      baUserId: "u1",
      submissionType: "wiki_edit",
      directWikiEdit: true,
    })
    expect(verdict).toMatchObject({ ok: false, status: 403 })
  })
})
