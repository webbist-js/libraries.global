// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { useAtlasDataGapPrompt } from "../useAtlasDataGapPrompt"

const session = vi.hoisted(() => ({
  user: null as null | { dismissedPrompts?: string[] },
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: session.user ? { user: session.user } : null,
    isPending: false,
  }),
}))

afterEach(() => {
  session.user = null
  vi.unstubAllGlobals()
})

it("keeps a signed-out reader's choice for this visit without storing it", async () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const cookie = document.cookie
  const { result } = renderHook(() => useAtlasDataGapPrompt())
  expect(result.current).toMatchObject({ ready: true, hidden: false })
  await act(async () => expect(await result.current.hide()).toBe(true))
  expect(result.current.hidden).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
  expect(document.cookie).toBe(cookie)
})

it("saves a signed-in reader's choice to their profile", async () => {
  session.user = { dismissedPrompts: [] }
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal("fetch", fetch)
  const { result } = renderHook(() => useAtlasDataGapPrompt())
  await act(async () => expect(await result.current.hide()).toBe(true))
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "/api/profile/me/prompts",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ prompt: "atlas-data-gap", dismissed: true }),
    })
  )
  expect(result.current.hidden).toBe(true)
})

it("leaves explanations on when saving fails", async () => {
  session.user = { dismissedPrompts: [] }
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
  const { result } = renderHook(() => useAtlasDataGapPrompt())
  await act(async () => expect(await result.current.hide()).toBe(false))
  expect(result.current.hidden).toBe(false)
})

it("honours a choice saved in Settings", () => {
  session.user = { dismissedPrompts: ["atlas-data-gap"] }
  const { result } = renderHook(() => useAtlasDataGapPrompt())
  expect(result.current).toMatchObject({ hidden: true, signedIn: true })
})
