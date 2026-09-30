import { beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
const getSessionSSR = vi.fn()

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: (...args: unknown[]) => getSessionSSR(...args),
}))
vi.mock("@/lib/seo/metadata", () => ({ privateMetadata: () => ({}) }))
vi.mock("../_components/ClaimLibraryForm", () => ({
  ClaimLibraryForm: () => null,
}))

// The page is compiled with the classic JSX runtime under vitest.
vi.stubGlobal("React", await import("react"))

const { default: ClaimLibraryPage } = await import("../page")

function run(params: Record<string, string>) {
  return ClaimLibraryPage({ searchParams: Promise.resolve(params) })
}

describe("/contribute/claim", () => {
  beforeEach(() => {
    redirect.mockClear()
    getSessionSSR.mockResolvedValue({ user: { id: "u1" } })
  })

  it("sends a signed-in user with no library to find one first", async () => {
    await expect(run({})).rejects.toThrow(
      "REDIRECT:/contribute/index?intent=claim"
    )
  })

  it("redirects when only the slug is given", async () => {
    await expect(run({ librarySlug: "british-library" })).rejects.toThrow(
      "REDIRECT:/contribute/index?intent=claim"
    )
  })

  it("renders the claim form when the library is known", async () => {
    const result = await run({
      librarySlug: "british-library",
      libraryDocumentId: "doc-1",
    })
    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it("sends a signed-out user to sign in", async () => {
    getSessionSSR.mockResolvedValue(null)
    await expect(run({})).rejects.toThrow(/REDIRECT:\/auth\/signin/)
  })
})
