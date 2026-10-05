import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

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

/** A claimant's edit that sets a library's hours and open status. */
const pendingHoursEdit = () => {
  const s: any = {
    documentId: "s0000000000000000000003",
    submissionType: "library_edit",
    status: "pending",
    submittedByUserId: "u3",
    targetDocumentId: "lib00000000000000000001",
    fields: {
      openingTimes: {
        version: 1,
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [{ startTime: "09:00", endTime: "17:00" }],
          },
        ],
      },
      operationalStatus: "open",
    },
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

/** "Still right?": confirms a library's hours and address, checked in person. */
const pendingVerify = () => {
  const s: any = {
    documentId: "s0000000000000000000004",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u4",
    targetDocumentId: "lib00000000000000000001",
    fields: { kind: "verify", sections: ["hours", "address"] },
    evidenceType: "on_site_visit",
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

/** A record correction from the Index editor: structured fields, not free text. */
const pendingRecordCorrection = () => {
  const s: any = {
    documentId: "s0000000000000000000005",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u4",
    targetDocumentId: "lib00000000000000000001",
    fields: {
      kind: "record",
      city: "York",
      phone: "01904 000000",
      previous: {},
    },
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

const LIBRARY_SEED = {
  "api::library.library": [
    {
      documentId: "lib00000000000000000001",
      slug: "lib",
      name: "Library",
      locale: "en",
    },
  ],
}

function setup(seed = pending()) {
  const f = makeFakeStrapi({ [UID]: [seed], ...LIBRARY_SEED })
  const award = vi.fn(async () => {})
  f.services["rewards.points"] = { award }

  return { ...f, award, svc: createService({ strapi: f.strapi }) }
}

describe("updateStatus", () => {
  it("awards points exactly once across two approvals", async () => {
    const { svc, award } = setup()
    const a = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      REVIEWER
    )
    const b = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      REVIEWER
    )
    expect("data" in a).toBe(true)
    expect(b).toEqual({ error: "invalid_transition" })
    expect(award).toHaveBeenCalledTimes(1)
    // The reviewer is stored with its kind prefix.
    expect((a as any).data.reviewedByUserId).toBe("admin:1")
  })

  it("refuses to re-open a decided submission", async () => {
    const { svc } = setup({ ...pending(), status: "approved" })
    expect(
      await svc.updateStatus("s0000000000000000000001", "pending", REVIEWER)
    ).toEqual({ error: "invalid_transition" })
  })

  it("refuses to approve if the payload changed after review started", async () => {
    const tampered = { ...pending(), fields: { a: 999 } }
    const { svc, award } = setup(tampered)
    expect(
      await svc.updateStatus("s0000000000000000000001", "approved", REVIEWER)
    ).toEqual({ error: "tampered" })
    expect(award).not.toHaveBeenCalled()
  })

  it("passes an idempotency key to rewards", async () => {
    const { svc, award } = setup()
    await svc.updateStatus("s0000000000000000000001", "approved", REVIEWER)
    expect(award).toHaveBeenCalledWith(
      "u1",
      "correction_approved",
      2,
      expect.anything(),
      "s0000000000000000000001:correction_approved"
    )
  })

  it("awards verification points for setting a library's hours and status", async () => {
    const edit = pendingHoursEdit()
    const { svc, award } = setup(edit)
    await svc.updateStatus(edit.documentId, "approved", REVIEWER)
    expect(award).toHaveBeenCalledWith(
      "u3",
      "hours_verified",
      5,
      expect.anything(),
      `${edit.documentId}:hours_verified`
    )
    expect(award).toHaveBeenCalledWith(
      "u3",
      "status_verified",
      5,
      expect.anything(),
      `${edit.documentId}:status_verified`
    )
  })

  it("awards hours_verified for a confirmed hours section, and the base correction points", async () => {
    const verify = pendingVerify()
    const { svc, award } = setup(verify)
    await svc.updateStatus(verify.documentId, "approved", REVIEWER)
    const actions = award.mock.calls.map((c: unknown[]) => c[1])
    expect(actions).toContain("hours_verified")
    expect(actions).not.toContain("status_verified")
    expect(actions).toContain("correction_approved")
  })

  it("awards no verification points for a free-text correction", async () => {
    const { svc, award } = setup()
    await svc.updateStatus("s0000000000000000000001", "approved", REVIEWER)
    const actions = award.mock.calls.map((c: unknown[]) => c[1])
    expect(actions).not.toContain("hours_verified")
    expect(actions).not.toContain("status_verified")
  })

  it("scores a record correction like a claimant's edit", async () => {
    const c = pendingRecordCorrection()
    const { svc, award } = setup(c)
    await svc.updateStatus(c.documentId, "approved", REVIEWER)
    expect(award).toHaveBeenCalledWith(
      "u4",
      "edit_accepted_minor",
      5,
      expect.anything(),
      `${c.documentId}:edit_accepted_minor`
    )
    const actions = award.mock.calls.map((x: unknown[]) => x[1])
    expect(actions).not.toContain("correction_approved")
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
      REVIEWER
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
      REVIEWER
    )

    expect(result).toEqual({ error: "apply_failed" })
    expect(award).not.toHaveBeenCalled()
    const stored = store[UID].find(
      (d: any) => d.documentId === claim.documentId
    )
    expect(stored?.status).toBe("pending")
  })
})
