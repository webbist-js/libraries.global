import { signPreviewTicket } from "@repo/shared-data/preview-ticket"
import { beforeEach, expect, it, vi } from "vitest"

const { query, enable, disable, set, redirect } = vi.hoisted(() => ({
  query: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  set: vi.fn(),
  redirect: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: { query } }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => "preview-test-key" }))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "fr", "cs"], defaultLocale: "en" },
  redirect,
}))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ enable, disable }),
  cookies: async () => ({ get: () => ({ value: "draft-cookie" }), set }),
}))
import { GET } from "./route"

beforeEach(() => vi.clearAllMocks())
it("consumes a ticket once across concurrent requests and uses only its signed target", async () => {
  const used = new Set<string>()
  query.mockImplementation(async (_sql, [nonce]) => {
    const replay = used.has(nonce)
    used.add(nonce)

    return { rows: replay ? [] : [{ key: nonce }] }
  })
  const ticket = signPreviewTicket(
    { url: "/about", locale: "fr", status: "draft" },
    "preview-test-key"
  )
  const url = `https://example.org/api/preview?ticket=${encodeURIComponent(ticket)}&url=/other&locale=en&status=published`
  const results = await Promise.all([
    GET(new Request(url)),
    GET(new Request(url)),
  ])
  expect(results.filter((response) => response?.status === 401)).toHaveLength(1)
  expect(enable).toHaveBeenCalledTimes(1)
  expect(disable).not.toHaveBeenCalled()
  expect(redirect).toHaveBeenCalledExactlyOnceWith({
    href: "/about",
    locale: "fr",
  })
  expect(query.mock.calls[0]![0]).toContain(
    "on conflict(key) do nothing returning key"
  )
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none" })
  )
})
it("denies the retired query-secret path before enabling draft mode or touching the database", async () => {
  const response = await GET(
    new Request(
      "https://example.org/api/preview?secret=preview-test-key&url=/about&status=draft"
    )
  )
  expect(response?.status).toBe(401)
  expect(query).not.toHaveBeenCalled()
  expect(enable).not.toHaveBeenCalled()
})
