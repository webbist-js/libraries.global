// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from "vitest"

import {
  articleCopyKey,
  readArticleCopy,
  saveArticleCopy,
  removeArticleCopy,
  type ArticleLocalCopy,
} from "./article-local-recovery"

const copy: ArticleLocalCopy = {
  owner: "a",
  target: "journal:story",
  locale: "es",
  submissionId: "own",
  baseRevision: "base",
  writtenAt: "2026-10-16T12:00:00Z",
  draft: {
    title: "A private draft",
    summary: "Summary",
    doc: { type: "doc", content: [] },
    sections: ["reports"],
    tags: [],
    editSummary: "",
  },
}
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  vi.restoreAllMocks()
})
describe("private local article recovery", () => {
  it("isolates owners, article targets and content languages and removes only explicitly selected own copy", () => {
    const a = articleCopyKey("a", "journal:story", "es"),
      b = articleCopyKey("b", "journal:story", "es"),
      fr = articleCopyKey("a", "journal:story", "fr")
    expect(saveArticleCopy(a, copy)).toBe(true)
    expect(saveArticleCopy(b, { ...copy, owner: "b" })).toBe(true)
    expect(readArticleCopy(a, "b")).toBeNull()
    expect(readArticleCopy(fr, "a")).toBeNull()
    expect(readArticleCopy(a, "a")).toEqual(copy)
    removeArticleCopy(a)
    expect(readArticleCopy(a, "a")).toBeNull()
    expect(readArticleCopy(b, "b")?.draft.title).toBe("A private draft")
  })
  it("does not throw or destroy live text when storage is blocked or full", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError")
      },
    })
    expect(
      saveArticleCopy(articleCopyKey("a", "journal:story", "es"), copy)
    ).toBe(false)
    expect(copy.draft.title).toBe("A private draft")
  })
})
