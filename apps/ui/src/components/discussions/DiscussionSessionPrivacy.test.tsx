// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@/test/render"

import { DiscussionThread } from "./DiscussionThread"

Object.assign(globalThis, { React })
const session = vi.hoisted(() => ({
  data: { user: { id: "writer" } },
  isPending: false,
  error: null as Error | null,
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => session }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
const fetch = vi.fn()
beforeEach(() => {
  fetch.mockReset()
  session.error = null
  session.isPending = false
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("removes cached private recovery text on a real hydrated-session network error in the same account", async () => {
  const pending = {
    id: "thread",
    subjectId: "subject",
    title: "Owner proposal",
    body: "",
    language: "en",
    state: "pending",
    version: 0,
    author: null,
    attachments: [],
    reactions: { like: 0, love: 0 },
    myReaction: null,
  }
  fetch.mockImplementation(async (url: string) =>
    Response.json(
      url.endsWith("/session")
        ? { signedIn: true, canModerate: false, viewerId: "writer" }
        : url === "/api/discussions/threads/thread"
          ? pending
          : {
              data: url.includes("kind=thread")
                ? [
                    {
                      ...pending,
                      pendingRevision: {
                        id: "revision",
                        body: "Recovered private text must disappear",
                        baseVersion: 0,
                        attachments: [],
                      },
                    },
                  ]
                : [],
            }
    )
  )
  const view = render(<DiscussionThread id="thread" />)
  await screen.findByText("Recovered private text must disappear")
  session.error = new Error("session service unavailable")
  view.rerender(<DiscussionThread id="thread" />)
  expect(screen.queryByText("Recovered private text must disappear")).toBeNull()
  expect(screen.queryByText("Owner proposal")).toBeNull()
  expect(screen.queryByRole("button", { name: "Edit your message" })).toBeNull()
})

it("never requests a private thread when the host verifies a different cookie account", async () => {
  fetch.mockResolvedValue(
    Response.json({
      signedIn: true,
      canModerate: true,
      viewerId: "another-account",
    })
  )
  render(<DiscussionThread id="thread" />)
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/discussions/session",
  ])
  expect(screen.queryByRole("button", { name: "Edit your message" })).toBeNull()
})
