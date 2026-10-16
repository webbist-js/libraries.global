// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ProfileFollowButton } from "../ProfileFollowButton"

const { actor, refresh } = vi.hoisted(() => ({
  actor: { id: "a" as string | null, pending: false },
  refresh: vi.fn(),
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: actor.id ? { user: { id: actor.id } } : null,
    isPending: actor.pending,
  }),
}))
vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ refresh }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  actor.id = "a"
  actor.pending = false
  fetchMock.mockResolvedValue(Response.json({ following: true }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("account-scoped person follow", () => {
  it("clears A's state before B's lookup resolves and ignores A's stale response", async () => {
    let finishA: ((response: Response) => void) | undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishA = resolve
        })
    )
    const view = render(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn />
    )
    const signalA = fetchMock.mock.calls[0]![1].signal as AbortSignal
    actor.id = "b"
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    view.rerender(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn />
    )
    expect(signalA.aborted).toBe(true)
    finishA?.(Response.json({ following: true }))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Following" })).toBeNull()
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Checking follow status…",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
  it("hides a loaded relationship during pending hydration, then loads the next account", async () => {
    const view = render(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn />
    )
    await screen.findByRole("button", { name: "Following" })
    actor.pending = true
    view.rerender(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn />
    )
    expect(screen.queryByRole("button", { name: "Following" })).toBeNull()
    actor.pending = false
    actor.id = "b"
    fetchMock.mockResolvedValue(Response.json({ following: false }))
    view.rerender(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn />
    )
    await screen.findByRole("button", { name: "Follow" })
    fireEvent.click(screen.getByRole("button", { name: "Follow" }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([, init]) =>
            init.method === "POST" && JSON.parse(init.body).action === "follow"
        )
      ).toBe(true)
    )
  })
  it("offers retry for failed status and does not allow an invented relationship write", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))
    render(
      <ProfileFollowButton targetUsername="public_reader" isSignedIn compact />
    )
    await screen.findByRole("alert")
    expect(
      (screen.getByRole("button", { name: "Follow" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fetchMock.mockResolvedValue(Response.json({ following: false }))
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Follow" }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    )
  })
})
