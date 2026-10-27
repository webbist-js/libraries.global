import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  fetchStaff: vi.fn(),
  target: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: mocks.session }))
vi.mock("@/lib/staff-proxy", () => ({
  fetchStaff: mocks.fetchStaff,
  resolveTargetStaff: mocks.target,
  withTargetStaff: (user: Record<string, unknown>, target: unknown) => ({
    ...user,
    staffLibraries: [
      target,
      ...(Array.isArray(user.staffLibraries) ? user.staffLibraries : []),
    ],
  }),
}))
vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchMany: vi.fn() },
}))

import { loadStaffPage } from "../server"

const ID = "lib000000000000000000001"
const OTHER_ID = "lib000000000000000000002"
const SLUG = "central-library"
const library = {
  id: ID,
  name: "Central Library",
  slug: SLUG,
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
}
const user = {
  id: "staff-user",
  capabilities: ["staff.area"],
  staffLibraries: [library],
}
const overview = {
  library: {
    documentId: ID,
    name: library.name,
    slug: SLUG,
    libraryType: "Public",
    path: "/europe/uk/kent/central-library",
  },
  role: "owner",
  health: [],
  counts: { suggestions: 0, noticesUpcoming: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.target.mockResolvedValue(null)
  mocks.session.mockResolvedValue({ user })
  mocks.fetchStaff.mockResolvedValue({ status: 200, body: overview })
})

describe("staff page access", () => {
  it("finds the library by slug among the viewer's staff memberships and loads its overview by id", async () => {
    const result = await loadStaffPage(SLUG)
    expect(result.documentId).toBe(ID)
    expect(result.overview).toBe(overview)
    expect(mocks.fetchStaff).toHaveBeenCalledWith(
      user,
      `libraries/${ID}/overview`
    )
  })

  it("resolves a current library outside a bounded service session summary", async () => {
    const scopedUser = {
      ...user,
      staffLibraries: Array.from({ length: 100 }, (_, i) => ({
        ...library,
        id: `library${String(i).padStart(17, "0")}`,
        slug: `other-${i}`,
      })),
    }
    mocks.session.mockResolvedValue({ user: scopedUser })
    mocks.target.mockResolvedValue(library)
    const result = await loadStaffPage(SLUG)
    expect(result.documentId).toBe(ID)
    expect(mocks.target).toHaveBeenCalledWith(scopedUser, SLUG)
    expect(result.libraries[0]?.id).toBe(ID)
  })

  it("also permits a verified editor", async () => {
    mocks.session.mockResolvedValue({
      user: { ...user, staffLibraries: [{ ...library, role: "editor" }] },
    })
    expect((await loadStaffPage(SLUG)).documentId).toBe(ID)
  })

  it.each([
    ["signed out", null],
    [
      "reader",
      { user: { id: "reader", capabilities: [], staffLibraries: [] } },
    ],
    [
      "pending claim",
      {
        user: {
          id: "pending",
          capabilities: [],
          staffLibraries: [],
          claimedLibraryIds: [ID],
        },
      },
    ],
    [
      "staff of another library",
      {
        user: {
          ...user,
          staffLibraries: [{ ...library, id: OTHER_ID, slug: "other-library" }],
        },
      },
    ],
    ["missing staff capability", { user: { ...user, capabilities: [] } }],
    [
      "malformed membership",
      { user: { ...user, staffLibraries: [{ ...library, role: "reader" }] } },
    ],
  ])("denies %s before any private API request", async (_label, session) => {
    mocks.session.mockResolvedValue(session)
    await expect(loadStaffPage(SLUG)).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchStaff).not.toHaveBeenCalled()
  })

  it.each([ID, "../central-library", "", "a b", "a".repeat(256)])(
    "does not accept a document id, an unknown slug or a malformed one: %s",
    async (param) => {
      await expect(loadStaffPage(param)).rejects.toThrow("NOT_FOUND")
      expect(mocks.fetchStaff).not.toHaveBeenCalled()
    }
  )

  it("refuses a slug that matches more than one membership", async () => {
    mocks.session.mockResolvedValue({
      user: {
        ...user,
        staffLibraries: [library, { ...library, id: OTHER_ID }],
      },
    })
    await expect(loadStaffPage(SLUG)).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchStaff).not.toHaveBeenCalled()
  })

  it.each([401, 403, 404])(
    "honours Strapi's refusal even with a cached staff session (%s)",
    async (status) => {
      mocks.fetchStaff.mockResolvedValue({ status, body: null })
      await expect(loadStaffPage(SLUG)).rejects.toThrow("NOT_FOUND")
    }
  )

  it.each([
    ["document id", { documentId: OTHER_ID }],
    ["slug", { slug: "other-library" }],
  ])("never renders an overview for another %s", async (_label, library) => {
    mocks.fetchStaff.mockResolvedValue({
      status: 200,
      body: { ...overview, library: { ...overview.library, ...library } },
    })
    await expect(loadStaffPage(SLUG)).rejects.toThrow("NOT_FOUND")
  })
})
