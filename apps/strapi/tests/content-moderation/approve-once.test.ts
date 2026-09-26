import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UID = "plugin::content-moderation.submission"
const pending = () => {
  const s: any = {
    documentId: "s0000000000000000000001",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u1",
    targetSlug: "x",
    fields: { a: 1 },
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

const pendingClaim = () => {
  const s: any = {
    documentId: "s0000000000000000000002",
    submissionType: "library_claim",
    status: "pending",
    submittedByUserId: "u2",
    targetDocumentId: "lib00000000000000000001",
    fields: {},
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

function setup(seed = pending()) {
  const f = makeFakeStrapi({ [UID]: [seed] })
  const award = vi.fn(async () => {})
  f.services["rewards.points"] = { award }
  f.services["api::user-profile.quick-wins"] = {
    computeAndSave: vi.fn(async () => {}),
  }

  return { ...f, award, svc: createService({ strapi: f.strapi }) }
}

describe("updateStatus", () => {
  it("awards points exactly once across two approvals", async () => {
    const { svc, award } = setup()
    const a = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      "admin1"
    )
    const b = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      "admin1"
    )
    expect("data" in a).toBe(true)
    expect(b).toEqual({ error: "invalid_transition" })
    expect(award).toHaveBeenCalledTimes(1)
  })

  it("refuses to re-open a decided submission", async () => {
    const { svc } = setup({ ...pending(), status: "approved" })
    expect(
      await svc.updateStatus("s0000000000000000000001", "pending", "admin1")
    ).toEqual({ error: "invalid_transition" })
  })

  it("refuses to approve if the payload changed after review started", async () => {
    const tampered = { ...pending(), fields: { a: 999 } }
    const { svc, award } = setup(tampered)
    expect(
      await svc.updateStatus("s0000000000000000000001", "approved", "admin1")
    ).toEqual({ error: "tampered" })
    expect(award).not.toHaveBeenCalled()
  })

  it("passes an idempotency key to rewards", async () => {
    const { svc, award } = setup()
    await svc.updateStatus("s0000000000000000000001", "approved", "admin1")
    expect(award).toHaveBeenCalledWith(
      "u1",
      "correction_approved",
      2,
      expect.anything(),
      "s0000000000000000000001:correction_approved"
    )
  })

  it("returns conflict when the compare-and-set loses the race", async () => {
    const { strapi, svc, award } = setup()
    const originalQuery = strapi.db.query
    strapi.db.query = vi.fn((uid: string) => ({
      ...originalQuery(uid),
      updateMany: vi.fn(async () => ({ count: 0 })),
    }))

    const result = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      "admin1"
    )

    expect(result).toEqual({ error: "conflict" })
    expect(award).not.toHaveBeenCalled()
  })

  it("reverts the status and returns apply_failed when a side effect throws", async () => {
    const claim = pendingClaim()
    const { strapi, store, svc, award } = setup(claim)
    const originalDocuments = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      if (uid === "api::library.library") {
        return {
          findOne: vi.fn(async () => {
            throw new Error("boom")
          }),
        }
      }

      return originalDocuments(uid)
    })

    const result = await svc.updateStatus(
      claim.documentId,
      "approved",
      "admin1"
    )

    expect(result).toEqual({ error: "apply_failed" })
    expect(award).not.toHaveBeenCalled()
    const stored = store[UID].find(
      (d: any) => d.documentId === claim.documentId
    )
    expect(stored?.status).toBe("pending")
  })
})
