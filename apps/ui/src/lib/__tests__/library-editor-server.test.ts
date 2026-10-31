import { beforeEach, expect, it, vi } from "vitest"

import { EMPTY_FORM } from "@/components/library-editor/wizard.types"

const mocks = vi.hoisted(() => ({
  library: vi.fn(),
  locales: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock("@/lib/article-editor-server", () => ({
  fetchArticleLocales: mocks.locales,
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchLibraryForEditing: mocks.library,
}))
vi.mock("@/lib/mobile/server", () => ({ fetchMobileTimetable: vi.fn() }))
vi.mock("@/components/library/library-page.helpers", () => ({
  computeCompleteness: () => ({ sections: [] }),
}))
vi.mock("@/components/library-editor/wizard.prefill", () => ({
  prefillLibrary: () => ({ ...EMPTY_FORM, name: "Library" }),
}))
const { loadLibraryEditor } = await import("../library-editor-server")
const actor = { id: "viewer", email: "viewer@example.org" }
const draftId = "abcdefghijklmnopqrstuvwx"
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.locales.mockResolvedValue([
    { code: "en", isDefault: true },
    { code: "fr", isDefault: false },
  ])
  mocks.library.mockResolvedValue({
    data: { documentId: "library-id", name: "Library", libraryType: "Public" },
  })
  mocks.fetch.mockResolvedValue(
    Response.json({
      data: [
        {
          documentId: draftId,
          targetSlug: "library",
          submissionType: "correction",
          status: "needs_info",
          locale: "en",
        },
      ],
    })
  )
})
it("resolves the content language and applies the same staff routing as the full page", async () => {
  const result = await loadLibraryEditor(
    "library",
    { ...actor, staffLibraries: [{ id: "library-id" }] },
    "fr",
    "hours"
  )
  expect(mocks.library).toHaveBeenCalledWith("library", "fr")
  expect(result?.locale?.code).toBe("fr")
  expect(result?.staffHref).toContain("/edit?locale=fr&step=3")
})
it("loads an exact returned draft only through the authenticated owner read", async () => {
  const result = await loadLibraryEditor(
    "library",
    actor,
    undefined,
    undefined,
    draftId
  )
  expect(result?.resumeSubmission?.documentId).toBe(draftId)
  expect(mocks.fetch.mock.calls[0]![1].headers["X-Ba-User-Id"]).toBe("viewer")
  expect(String(mocks.fetch.mock.calls[0]![0])).toContain(
    `documentId=${draftId}`
  )
})
it("refuses another library's or language's submission", async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({
      data: [
        {
          targetSlug: "another-library",
          status: "draft",
          submissionType: "correction",
          locale: "en",
        },
      ],
    })
  )
  expect(
    await loadLibraryEditor("library", actor, undefined, undefined, draftId)
  ).toBeNull()
  mocks.fetch.mockResolvedValue(
    Response.json({
      data: [
        {
          targetSlug: "library",
          status: "draft",
          submissionType: "correction",
          locale: "fr",
        },
      ],
    })
  )
  expect(
    await loadLibraryEditor("library", actor, undefined, undefined, draftId)
  ).toBeNull()
})
