import { afterEach, expect, it, vi } from "vitest"

import { loadNewLibraryDraft } from "../new-library-draft-server"

const user = { id: "viewer", email: "viewer@example.org" }
afterEach(() => vi.unstubAllGlobals())
it("loads the selected owned new-library draft through the private endpoint", async () => {
  const row = {
    documentId: "selected",
    submissionType: "new_library",
    status: "draft",
    draftData: { name: "Selected" },
  }
  const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [row] }))
  vi.stubGlobal("fetch", fetcher)
  expect(await loadNewLibraryDraft("selected", user, false)).toEqual(row)
  expect(fetcher.mock.calls[0]![0]).toContain(
    "/submissions/my?documentId=selected"
  )
})
it.each([
  [],
  [{ documentId: "other", submissionType: "new_library", status: "draft" }],
  [
    {
      documentId: "selected",
      submissionType: "new_library",
      status: "approved",
    },
  ],
  [
    {
      documentId: "selected",
      submissionType: "new_library",
      status: "draft",
      draftData: { staffCreation: {} },
    },
  ],
])(
  "does not fall back to another draft when the selection is unavailable",
  async (...args) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: args }))
    )
    await expect(loadNewLibraryDraft("selected", user, false)).rejects.toThrow()
  }
)
