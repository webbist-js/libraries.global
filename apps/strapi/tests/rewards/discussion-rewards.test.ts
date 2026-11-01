import { describe, expect, it, vi } from "vitest"

import { awardDiscussionContribution } from "../../src/utils/discussion-rewards"

function fixture(overrides: Record<string, unknown> = {}) {
  const award = vi.fn(async () => ({ awarded: true }))
  const record = { state: "visible", authorKey: "ba:original", ...overrides }
  const revision = {
    documentId: "revision",
    state: "approved",
    authorKey: "ba:writer",
    baseVersion: 0,
    decidedAt: "2026-01-01T12:00:00Z",
  }
  const findRevision = vi.fn(async () => revision)
  const strapi = {
    db: {
      query: (uid: string) => ({
        findOne: uid.endsWith("revision")
          ? findRevision
          : vi.fn(async () => record),
      }),
    },
    plugin: () => ({ service: () => ({ award }) }),
  }

  return { strapi, award, revision, findRevision }
}
const event = {
  id: "event",
  type: "visible" as const,
  recordType: "reply" as const,
  recordId: "reply",
  threadId: "thread",
  version: 1,
}
describe("discussion rewards", () => {
  it("credits the approved revision author once, using an idempotent revision key and original approval time", async () => {
    const f = fixture()
    await awardDiscussionContribution(f.strapi, event)
    expect(f.findRevision).toHaveBeenCalledWith({
      where: {
        recordType: "reply",
        recordId: "reply",
        baseVersion: 0,
        state: "approved",
      },
    })
    expect(f.award).toHaveBeenCalledWith(
      "writer",
      "discussion_reply_accepted",
      1,
      expect.any(Object),
      "discussion:revision:accepted",
      new Date("2026-01-01T12:00:00Z")
    )
  })
  it("credits an approved edit as an edit", async () => {
    const f = fixture()
    f.revision.baseVersion = 2
    await awardDiscussionContribution(f.strapi, { ...event, version: 3 })
    expect(f.award).toHaveBeenCalledWith(
      "writer",
      "discussion_edit_accepted",
      1,
      expect.any(Object),
      expect.any(String),
      expect.any(Date)
    )
  })
  it.each(["pending", "removed", "rejected"])(
    "does not reward a %s record",
    async (state) => {
      const f = fixture({ state })
      await awardDiscussionContribution(f.strapi, event)
      expect(f.award).not.toHaveBeenCalled()
    }
  )
  it("does not award removals or anonymization", async () => {
    const f = fixture()
    await awardDiscussionContribution(f.strapi, { ...event, type: "removed" })
    await awardDiscussionContribution(f.strapi, {
      ...event,
      type: "anonymized",
    })
    expect(f.award).not.toHaveBeenCalled()
  })
})
