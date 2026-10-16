// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: { user: { id: "moderator", moderationScopes: ["discussions"] } } as {
    user: { id: string; moderationScopes: string[] }
  } | null,
  isPending: false,
  error: null as Error | null,
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => session }))
import { useDiscussionActor } from "./useDiscussionActor"

const fetch = vi.fn()
beforeEach(() => {
  session.data = {
    user: { id: "moderator", moderationScopes: ["discussions"] },
  }
  session.isPending = false
  session.error = null
  fetch.mockReset()
  vi.stubGlobal("fetch", fetch)
})
describe("discussion host permission hint", () => {
  it("does not reuse a privileged hint when the same account's moderation scope changes", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({
        signedIn: true,
        canModerate: true,
        viewerId: "moderator",
      })
    )
    const view = renderHook(useDiscussionActor)
    await waitFor(() => expect(view.result.current.canModerate).toBe(true))
    let resolve!: (value: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    session.data = { user: { id: "moderator", moderationScopes: ["journal"] } }
    view.rerender()
    expect(view.result.current).toMatchObject({
      ready: false,
      canModerate: false,
    })
    await act(async () =>
      resolve(
        Response.json({
          signedIn: true,
          canModerate: false,
          viewerId: "moderator",
        })
      )
    )
    expect(view.result.current).toMatchObject({
      ready: true,
      signedIn: true,
      canModerate: false,
    })
  })
  it("refuses a server hint for a different account even if the client still holds a session", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({
        signedIn: true,
        canModerate: true,
        viewerId: "another-account",
      })
    )
    const view = renderHook(useDiscussionActor)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(view.result.current).toMatchObject({
      signedIn: false,
      canModerate: false,
      ready: false,
    })
  })
  it("invalidates a matching cached hint after a session network error and waits for new verification", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({
        signedIn: true,
        canModerate: true,
        viewerId: "moderator",
      })
    )
    const view = renderHook(useDiscussionActor)
    await waitFor(() => expect(view.result.current.signedIn).toBe(true))
    session.error = new Error("session verification unavailable")
    view.rerender()
    expect(view.result.current).toMatchObject({
      ready: false,
      signedIn: false,
      canModerate: false,
    })
    session.error = null
    fetch.mockImplementationOnce(() => new Promise(() => {}))
    view.rerender()
    expect(view.result.current.ready).toBe(false)
  })
})
