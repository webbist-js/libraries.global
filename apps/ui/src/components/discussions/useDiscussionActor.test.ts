// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: { user: { id: "moderator", moderationScopes: ["discussions"] } } as {
    user: { id: string; moderationScopes: string[] }
  } | null,
  isPending: false,
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => session }))
import { useDiscussionActor } from "./useDiscussionActor"

const fetch = vi.fn()
beforeEach(() => {
  session.data = {
    user: { id: "moderator", moderationScopes: ["discussions"] },
  }
  session.isPending = false
  vi.stubGlobal("fetch", fetch)
})
describe("discussion host permission hint", () => {
  it("does not reuse a privileged hint when the same account's moderation scope changes", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({ signedIn: true, canModerate: true })
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
      resolve(Response.json({ signedIn: true, canModerate: false }))
    )
    expect(view.result.current).toMatchObject({
      ready: true,
      signedIn: true,
      canModerate: false,
    })
  })
  it("requires session identity even if the host hint says signed in", async () => {
    session.data = null
    fetch.mockResolvedValueOnce(
      Response.json({ signedIn: true, canModerate: true })
    )
    const view = renderHook(useDiscussionActor)
    await waitFor(() => expect(view.result.current.ready).toBe(true))
    expect(view.result.current).toMatchObject({
      signedIn: false,
      canModerate: false,
    })
  })
})
