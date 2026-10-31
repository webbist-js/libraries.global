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
vi.mock("@/components/library-editor/LibraryClaimWorkspace", () => ({
  LibraryClaimWorkspace: () => null,
}))
vi.mock("../../_components/ContributeSectionHeader", () => ({
  ContributeSectionHeader: () => null,
}))
vi.mock("@/components/staff/knowledge-links", () => ({
  KNOWLEDGE_SLUGS: { staffArea: "staff-area" },
  knowledgeLink: async () => null,
}))
vi.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async () => String,
}))
vi.mock("@/lib/access-server", () => ({ sessionTeamsOf: () => [] }))
vi.mock("@/components/ds/PageHero", () => ({ PageHero: () => null }))
vi.mock("@/components/auth/FeatureAccessLanding", () => ({
  FeatureAccessLanding: () => null,
}))
vi.mock("@/components/dashboard/WorkspaceHero", () => ({
  WorkspacePageHeader: () => null,
}))
vi.mock("@/components/staff/StaffAreaTabs", () => ({
  StaffAreaTabs: () => null,
}))

// The page is compiled with the classic JSX runtime under vitest.
vi.stubGlobal("React", await import("react"))

const { default: ClaimLibraryPage } = await import("../page")
const { default: StaffClaimPage } = await import("../../../staff/claim/page")

function run(params: Record<string, string>) {
  return ClaimLibraryPage({ searchParams: Promise.resolve(params) })
}

describe("/contribute/claim", () => {
  beforeEach(() => {
    redirect.mockClear()
    getSessionSSR.mockResolvedValue({ user: { id: "u1" } })
  })

  it("renders its own search page without redirecting to the index editor", async () => {
    expect(await run({})).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("can search again when a preselected record is incomplete", async () => {
    expect(await run({ librarySlug: "british-library" })).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("renders the claim form when the library is known", async () => {
    const result = await run({
      librarySlug: "british-library",
      libraryDocumentId: "doc-1",
    })
    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it("offers a signed-out user the claim sign-in landing", async () => {
    getSessionSSR.mockResolvedValue(null)
    const result = await run({})
    expect(result.props.feature).toBe("claim")
    const signIn = new URL(result.props.signInHref, "https://example.test")
    expect(signIn.pathname).toBe("/auth/signin")
    expect(signIn.searchParams.get("callbackUrl")).toBe("/fr/contribute/claim")
  })
  it("keeps the locale and imported entity reference through Staff sign-in", async () => {
    getSessionSSR.mockResolvedValue(null)
    const params = {
      libraryDocumentId: "doc&1",
      librarySlug: "city library",
      libraryName: "City & District",
      libraryEntityRef: "import:gb:1&2",
    }
    const result = await StaffClaimPage({
      searchParams: Promise.resolve(params),
    })
    expect(result.props.feature).toBe("claim")
    const signIn = new URL(result.props.signInHref, "https://example.test")
    const callback = new URL(
      signIn.searchParams.get("callbackUrl")!,
      "https://example.test"
    )
    expect(callback.pathname).toBe("/fr/staff/claim")
    expect(Object.fromEntries(callback.searchParams)).toEqual(params)
  })
  it("lets people without staff access start a claim inside Staff", async () => {
    expect(
      await StaffClaimPage({ searchParams: Promise.resolve({}) })
    ).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
