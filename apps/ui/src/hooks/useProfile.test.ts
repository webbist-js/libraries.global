// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { createTranslator } from "next-intl"
import type * as NextIntl from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useProfile } from "./useProfile"
import en from "../../locales/en"

const refetch = vi.hoisted(() => vi.fn(async () => {}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ refetch }) },
}))
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof NextIntl>()),
  useTranslations: () =>
    createTranslator({
      locale: "en",
      messages: en,
      namespace: "profileFeedback",
    }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  refetch.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe("profile preferences refresh", () => {
  it("refreshes reactive session preferences after a successful country/language save", async () => {
    refetch.mockResolvedValue(undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: {} }))
    )
    const view = renderHook(useProfile)
    await act(async () =>
      expect(await view.result.current.updateProfile({ country: "CO" })).toBe(
        true
      )
    )
    expect(refetch).toHaveBeenCalledTimes(1)
  })
  it("keeps a successful save successful if session refresh is temporarily unavailable", async () => {
    refetch.mockRejectedValue(new Error("offline"))
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: {} }))
    )
    const view = renderHook(useProfile)
    await act(async () =>
      expect(await view.result.current.updateProfile({ country: "CO" })).toBe(
        true
      )
    )
  })
  it("does not refresh preferences after a rejected save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Unavailable" }, { status: 503 })
      )
    )
    const view = renderHook(useProfile)
    await act(async () =>
      expect(await view.result.current.updateProfile({ country: "CO" })).toBe(
        false
      )
    )
    expect(refetch).not.toHaveBeenCalled()
  })
})
