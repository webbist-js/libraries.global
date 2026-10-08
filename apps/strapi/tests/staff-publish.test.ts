import { describe, it, expect, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import createStaff from "../src/plugins/content-moderation/server/services/staff"
import createSubmissions from "../src/plugins/content-moderation/server/services/submission"
import {
  isSelfReview,
  staffReviewer,
} from "../src/plugins/content-moderation/server/utils/reviewer"
import { canTransition } from "../src/plugins/content-moderation/server/utils/transitions"
import { resolveChangeContext } from "../src/utils/change-context"

const LIB = "api::library.library",
  SUB = "plugin::content-moderation.submission",
  REVIEW = "plugin::content-moderation.review-event",
  AFF = "api::library-affiliation.library-affiliation"
const id = "library00000000000000001",
  other = "library00000000000000002"
const viewer = {
  id: "staff",
  email: "staff@example.org",
  name: "Library staff",
}
function setup() {
  const f = makeFakeStrapi({
    [LIB]: [
      {
        documentId: id,
        name: "Old name",
        slug: "old",
        locale: "en",
        summary: "Old summary",
        streetAddress: "Old street",
      },
      { documentId: other, name: "Other", slug: "other" },
    ],
    [AFF]: [
      {
        documentId: "affiliation0000000000001",
        baUserId: viewer.id,
        library: { documentId: id },
        role: "Librarian",
        staffRole: "owner",
        approvedAt: "2026-01-01",
      },
    ],
  })
  f.services["content-moderation.submission"] = createSubmissions({
    strapi: f.strapi,
  })

  return { ...f, staff: createStaff({ strapi: f.strapi }) }
}
describe("staff publishing", () => {
  it("allows draft to approved only for the explicit staff transition", () => {
    expect(canTransition("draft", "approved")).toBe(false)
    expect(canTransition("draft", "approved", { staffPublish: true })).toBe(
      true
    )
  })
  it("publishes the owned record with staff provenance and no reward service", async () => {
    const f = setup(),
      original = f.strapi.documents
    const contexts: unknown[] = []
    f.strapi.documents = (uid: string) => {
      const service = original(uid)
      if (uid === LIB) {
        const update = service.update
        service.update = async (args: any) => {
          contexts.push(resolveChangeContext(f.strapi))

          return update(args)
        }
      }

      return service
    }
    const result = await f.staff.publish(viewer, id, {
      fields: { summary: "New summary" },
      previous: { summary: "Old summary" },
    })
    expect(result.published).toEqual(["summary"])
    expect(f.store[LIB]![0]!.summary).toBe("New summary")
    expect(f.store[SUB]![0]).toMatchObject({
      status: "approved",
      draftData: { staffPublish: true },
      reviewedByUserId: "ba:staff",
    })
    expect(f.store[REVIEW]![0]).toMatchObject({
      fromStatus: "draft",
      toStatus: "approved",
      reviewerKind: "staff",
    })
    expect(contexts).toContainEqual(
      expect.objectContaining({ source: "staff", actorId: "ba:staff" })
    )
    expect(
      f.strapi.plugin.mock.calls.some((call: any[]) => call[0] === "rewards")
    ).toBe(false)
  })
  it("publishes facility answers: a No persists in absentFacilities, checked for staleness", async () => {
    const f = setup()
    f.store[LIB]![0]!.absentFacilities = ["Wi-Fi"]
    const result = await f.staff.publish(viewer, id, {
      fields: { absentFacilities: ["Wi-Fi", "Step-free entrance"] },
      previous: { absentFacilities: ["Wi-Fi"] },
    })
    expect(result.published).toEqual(["absentFacilities"])
    expect(result.requested).toEqual([])
    expect(f.store[LIB]![0]!.absentFacilities).toEqual([
      "Step-free entrance",
      "Wi-Fi",
    ])
    await expect(
      f.staff.publish(viewer, id, {
        fields: { absentFacilities: [] },
        previous: { absentFacilities: ["Wi-Fi"] },
      })
    ).rejects.toMatchObject({ status: 409, code: "stale" })
  })
  it("splits sensitive fields into a pending staff request", async () => {
    const f = setup()
    f.services["content-moderation.submission"].notifyPending = vi.fn()
    const result = await f.staff.publish(viewer, id, {
      fields: { summary: "New summary", streetAddress: "New street" },
      previous: { summary: "Old summary", streetAddress: "Old street" },
    })
    expect(result.requested).toEqual(["streetAddress"])
    expect(f.store[LIB]![0]!.streetAddress).toBe("Old street")
    expect(f.store[SUB]!.find((s) => s.status === "pending")).toMatchObject({
      draftData: { requestedByStaff: true },
      fields: { streetAddress: "New street" },
    })
    expect(
      f.services["content-moderation.submission"].notifyPending
    ).toHaveBeenCalledOnce()
  })
  it("routes mobile home-base changes to a moderator", async () => {
    const f = setup()
    f.services["content-moderation.submission"].notifyPending = vi.fn()
    const result = await f.staff.publish(viewer, id, {
      fields: { homeLibrary: other },
      previous: { homeLibrary: "" },
    })
    expect(result.published).toEqual([])
    expect(result.requested).toEqual(["homeLibrary"])
    expect(f.store[LIB]![0]).not.toHaveProperty("homeLibrary")
    expect(f.store[SUB]!.find((s) => s.status === "pending")).toMatchObject({
      fields: { homeLibrary: other },
    })
  })
  it("rejects a stale field before any write", async () => {
    const f = setup()
    await expect(
      f.staff.publish(viewer, id, {
        fields: { summary: "New" },
        previous: { summary: "A stale copy" },
      })
    ).rejects.toMatchObject({ status: 409, code: "stale" })
    expect(f.store[SUB]).toBeUndefined()
    expect(f.store[LIB]![0]!.summary).toBe("Old summary")
  })
  it("returns 404 for another library and proposer affiliations", async () => {
    const f = setup()
    await expect(
      f.staff.publish(viewer, other, {
        fields: { name: "X" },
        previous: { name: "Other" },
      })
    ).rejects.toMatchObject({ status: 404 })
    f.store[AFF]![0]!.role = "proposer"
    await expect(
      f.staff.publish(viewer, id, {
        fields: { name: "X" },
        previous: { name: "Old name" },
      })
    ).rejects.toMatchObject({ status: 404 })
  })
  it("rolls back library and submission when the review event fails", async () => {
    const f = setup(),
      original = f.strapi.documents
    f.strapi.documents = (uid: string) =>
      uid === REVIEW
        ? {
            create: async () => {
              throw new Error("audit failed")
            },
          }
        : original(uid)
    await expect(
      f.staff.publish(viewer, id, {
        fields: { summary: "New" },
        previous: { summary: "Old summary" },
      })
    ).rejects.toThrow("audit failed")
    expect(f.store[LIB]![0]!.summary).toBe("Old summary")
    expect(f.store[SUB]).toBeUndefined()
  })
  it("refuses to publish an unrelated admin draft", async () => {
    const f = setup()
    f.store[LIB]![0]!.__published = structuredClone(f.store[LIB]![0])
    f.store[LIB]![0]!.name = "Unpublished admin name"
    await expect(
      f.staff.publish(viewer, id, {
        fields: { summary: "New" },
        previous: { summary: "Old summary" },
      })
    ).rejects.toMatchObject({ status: 409, code: "unpublished_admin_edits" })
    expect(f.store[LIB]![0]!.summary).toBe("Old summary")
  })
  it("refuses staff self review by user id, even with a changed email", () => {
    expect(
      isSelfReview(staffReviewer({ id: viewer.id, email: "new@example.org" }), {
        submittedByUserId: viewer.id,
        submittedByEmail: "old@example.org",
      })
    ).toBe(true)
  })
  it("delegates suggestion decisions to the existing atomic moderation service", async () => {
    const f = setup(),
      decision = vi.fn(async () => ({ data: {} }))
    f.store[SUB] = [
      {
        documentId: "suggestion000000000000001",
        submissionType: "correction",
        status: "pending",
        targetDocumentId: id,
        targetEntityType: "library",
        submittedByUserId: "community",
        fields: { kind: "record", summary: "New" },
      },
    ]
    f.services["content-moderation.submission"].updateStatus = decision
    expect(
      await f.staff.decision(viewer, f.store[SUB][0]!.documentId, {
        action: "approve",
      })
    ).toMatchObject({ status: "approved" })
    expect(decision).toHaveBeenCalledWith(
      f.store[SUB][0]!.documentId,
      "approved",
      expect.objectContaining({ kind: "staff", id: "ba:staff" }),
      "Accepted by library staff"
    )
  })
  it("requires a decline reason and a note for Other", async () => {
    const f = setup()
    f.store[SUB] = [
      {
        documentId: "suggestion000000000000001",
        submissionType: "correction",
        targetDocumentId: id,
        targetEntityType: "library",
        submittedByUserId: "community",
        fields: { kind: "record" },
      },
    ]
    await expect(
      f.staff.decision(viewer, f.store[SUB][0]!.documentId, {
        action: "reject",
        reason: "other",
      })
    ).rejects.toMatchObject({ status: 400, code: "decline_reason_required" })
  })
})
