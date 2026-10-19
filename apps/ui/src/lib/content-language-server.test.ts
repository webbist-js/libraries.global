import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  locales: vi.fn(),
  headers: new Headers(),
}))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: async () => mocks.headers }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: mocks.session }))

vi.mock("@/lib/content-locales-server", () => ({
  fetchContentLocales: mocks.locales,
}))

import { getPreferredContentLanguage } from "@/lib/content-language-server"

beforeEach(() => {
  mocks.session.mockReset()
  mocks.locales.mockResolvedValue([{ code: "en" }, { code: "fr" }])
})
describe("request-specific content defaults", () => {
  it("reads the current profile without caching another user's language", async () => {
    mocks.session.mockResolvedValueOnce({
      user: {
        compositionPreferences: {
          languages: [{ code: "es", proficiency: "native" }],
        },
      },
    })
    mocks.session.mockResolvedValueOnce(null)
    expect(await getPreferredContentLanguage("fr")).toBe("fr")
    expect(await getPreferredContentLanguage("fr")).toBe("fr")
    expect(mocks.session).toHaveBeenCalledWith(mocks.headers)
  })
})

it("does not default to a translated route which is disabled in the CMS", async () => {
  mocks.locales.mockResolvedValue([{ code: "en" }])
  mocks.session.mockResolvedValue({
    user: {
      compositionPreferences: {
        languages: [{ code: "fr", proficiency: "native" }],
      },
    },
  })
  expect(await getPreferredContentLanguage("fr")).toBe("en")
})
