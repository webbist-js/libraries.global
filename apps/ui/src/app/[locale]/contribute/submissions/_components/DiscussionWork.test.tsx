// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen, fireEvent } from "@/test/render"

import { DiscussionWork } from "./DiscussionWork"

const actor = vi.hoisted(() => ({ id: "a", pending: false }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: actor.id } },
    isPending: actor.pending,
    error: null,
  }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  actor.id = "a"
  actor.pending = false
})
it("uses owner record bridge paths, shows contributor feedback safely, and never displays A's text for B", async () => {
  const fetcher = vi.fn(async (url: string) =>
    Response.json({
      data: [
        {
          id: actor.id,
          threadId: "parent-thread",
          title: actor.id === "a" ? "Private work A" : "Private work B",
          body: "Body",
          language: "es",
          state: "pending",
          version: 1,
          author: { name: "Writer" },
          latestRevision: {
            id: "revision",
            state: "changes_requested",
            body: "<script>proposal()</script>",
            baseVersion: 1,
            feedback: "Please add a public citation",
          },
        },
      ],
    })
  )
  vi.stubGlobal("fetch", fetcher)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const tree = () => (
    <QueryClientProvider client={client}>
      <DiscussionWork />
    </QueryClientProvider>
  )
  const view = render(tree())
  expect(await screen.findByText("Private work A")).toBeTruthy()
  expect(fetcher).toHaveBeenCalledWith(
    "/api/discussions/my/records?kind=thread&limit=20&offset=0",
    expect.objectContaining({ credentials: "same-origin", cache: "no-store" })
  )
  expect(screen.getByText("<script>proposal()</script>")).toBeTruthy()
  expect(view.container.querySelector("script")).toBeNull()
  expect(screen.getByText("Please add a public citation")).toBeTruthy()
  expect(screen.getByText("Latest revision: Changes requested")).toBeTruthy()
  expect(screen.getByText(/Threads · Spanish · Changes requested/)).toBeTruthy()
  expect(screen.queryByText(/changes_requested/)).toBeNull()
  actor.pending = true
  view.rerender(tree())
  expect(screen.queryByText("Private work A")).toBeNull()
  actor.id = "b"
  actor.pending = false
  view.rerender(tree())
  expect(await screen.findByText("Private work B")).toBeTruthy()
  expect(screen.queryByText("Private work A")).toBeNull()
  fireEvent.change(screen.getByLabelText("Type"), {
    target: { value: "reply" },
  })
  expect(
    await screen.findByRole("link", { name: "Open the conversation" })
  ).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Open the conversation" })
      .getAttribute("href")
  ).toBe("/community/discussions/parent-thread")
})
