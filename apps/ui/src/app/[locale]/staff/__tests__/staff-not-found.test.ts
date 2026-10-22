import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pathname: vi.fn(),
  session: vi.fn(),
  library: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/app/[locale]/staff/_lib/staff-pathname", () => ({
  staffPathname: mocks.pathname,
}))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: mocks.session }))
vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchMany: mocks.library },
}))
vi.mock("@/components/staff/StaffAccessRequired", () => ({
  StaffAccessRequired: () => null,
}))

import StaffNotFound from "../not-found"

const ID = "lib000000000000000000001"
const SLUG = "central-library"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname.mockResolvedValue(`/staff/${SLUG}/edit?step=hours`)
  mocks.session.mockResolvedValue(null)
  mocks.library.mockResolvedValue({
    data: [
      {
        documentId: ID,
        name: "Central Library",
        slug: "central-library",
        entityRef: "europe:united-kingdom:kent:maidstone:central-library",
        continent: { slug: "europe" },
        country: { slug: "united-kingdom" },
        region: { slug: "kent" },
        privateStaffData: "must not reach the page",
      },
    ],
  })
})

describe("denied staff page", () => {
  it("reads a published library by slug and passes only its public identity to the claim page", async () => {
    const page = await StaffNotFound()
    expect(mocks.library).toHaveBeenCalledWith(
      "api::library.library",
      expect.objectContaining({
        filters: { slug: { $eq: SLUG } },
        status: "published",
        fields: ["name", "slug", "entityRef"],
      }),
      { next: { revalidate: 0 } }
    )
    expect(page.props.library).toEqual({
      documentId: ID,
      name: "Central Library",
      slug: "central-library",
      entityRef: "europe:united-kingdom:kent:maidstone:central-library",
      path: "/europe/united-kingdom/kent/central-library",
    })
    expect(page.props.returnTo).toBe(`/staff/${SLUG}/edit?step=hours`)
    expect(page.props.signedIn).toBe(false)
  })

  it("keeps an unknown library as a generic claim prompt", async () => {
    mocks.library.mockResolvedValue({ data: [] })
    expect((await StaffNotFound()).props.library).toBeUndefined()
  })

  it.each([
    "/staff/team",
    "/staff/team/join/tok1",
    "/staff/teams",
    "/staff/teams/join/tok1",
    "/staff/bad%2Fslug",
    "/staff/-leading",
    `/staff/${"a".repeat(256)}`,
    "/staff",
  ])("does not query a library for %s", async (path) => {
    mocks.pathname.mockResolvedValue(path)
    await StaffNotFound()
    expect(mocks.library).not.toHaveBeenCalled()
  })
})
