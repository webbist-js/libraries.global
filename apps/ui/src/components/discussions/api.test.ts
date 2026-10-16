import { afterEach, describe, expect, it, vi } from "vitest"

import {
  discussionHref,
  discussionRequest,
  DiscussionRequestError,
  discussionFilters,
  discussionThreadQuery,
  orderedDiscussionReplies,
  type DiscussionRecord,
} from "./api"

afterEach(() => vi.unstubAllGlobals())
describe("discussion bridge", () => {
  it("keeps bookmarkable view/language/search filters bounded and places nested replies beside their parent", () => {
    const filters = discussionFilters(
      new URLSearchParams(
        `subject=public&lang=es&view=following&q=${"x".repeat(500)}`
      )
    )
    expect(filters).toMatchObject({
      subjectId: "public",
      language: "es",
      view: "following",
    })
    expect(filters.q).toHaveLength(180)
    const query = new URLSearchParams(discussionThreadQuery(filters, 20))
    expect(query.get("offset")).toBe("20")
    expect(query.get("language")).toBe("es")
    const child = { id: "child", parentId: "parent" } as DiscussionRecord
    const parent = { id: "parent" } as DiscussionRecord
    const sibling = { id: "sibling" } as DiscussionRecord
    const sorted = orderedDiscussionReplies([child, sibling, parent])
    expect(sorted.map(({ record }) => record.id)).toEqual([
      "sibling",
      "parent",
      "child",
    ])
    expect(sorted[2]).toMatchObject({ depth: 1, parent })
    expect(
      orderedDiscussionReplies([
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" },
      ] as DiscussionRecord[])
    ).toHaveLength(2)
  })
  it("uses the host proxy and sends only explicit record inputs", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ state: "pending" }))
    vi.stubGlobal("fetch", fetch)
    await discussionRequest("records/thread/thread-id/revisions", "POST", {
      body: "Revised",
      baseVersion: 2,
    })
    expect(fetch).toHaveBeenCalledWith(
      "/api/discussions/records/thread/thread-id/revisions",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ body: "Revised", baseVersion: 2 }),
      })
    )
  })
  it("retains the status while withholding arbitrary upstream error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "private token details" } },
            { status: 409 }
          )
        )
    )
    await expect(discussionRequest("threads/thread-id")).rejects.toEqual(
      new DiscussionRequestError(409)
    )
  })
  it("rejects active schemes, protocol-relative links and credential URLs", () => {
    expect(discussionHref("data:text/html,bad")).toBeNull()
    expect(discussionHref("//evil.example")).toBeNull()
    expect(discussionHref("/\n/evil.example")).toBeNull()
    expect(discussionHref("https://user:pass@example.org")).toBeNull()
    expect(discussionHref("/profile/alex")).toBe("/profile/alex")
    expect(discussionHref("https://example.org/profile")).toBe(
      "https://example.org/profile"
    )
  })
})
