// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@/test/render"

import {
  fetchJournalOwnership,
  useJournalOwnership,
} from "./use-journal-ownership"

const actor = vi.hoisted(() => ({
  id: "a",
  pending: false,
  error: null as object | null,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: actor.id, name: "Private name" } },
    isPending: actor.pending,
    error: actor.error,
  }),
}))
function Probe() {
  const ownership = useJournalOwnership(["story"])

  return (
    <>
      {ownership.eligibility.story === true
        ? "Can edit own story"
        : "No confirmed ownership"}
    </>
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  actor.id = "a"
  actor.pending = false
  actor.error = null
})
it("clears visible eligibility immediately on pending/actor switch and ignores an aborted account's result", async () => {
  let finishA!: (response: Response) => void
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishA = resolve
        })
    )
    .mockResolvedValueOnce(
      Response.json({ data: { eligibility: { story: false } } })
    )
  vi.stubGlobal("fetch", fetcher)
  const view = render(<Probe />)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  actor.pending = true
  view.rerender(<Probe />)
  expect(screen.queryByText("Can edit own story")).toBeNull()
  expect((fetcher.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true)
  actor.id = "b"
  actor.pending = false
  view.rerender(<Probe />)
  finishA(Response.json({ data: { eligibility: { story: true } } }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(screen.queryByText("Can edit own story")).toBeNull()
})
it("hides previously proven ownership on an auth network error without treating it as a different account", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: { eligibility: { story: true } } }))
  )
  const view = render(<Probe />)
  expect(await screen.findByText("Can edit own story")).toBeTruthy()
  actor.error = { message: "unavailable" }
  view.rerender(<Probe />)
  expect(screen.queryByText("Can edit own story")).toBeNull()
})

it("checks every loaded story while keeping each private request within the 24-story limit", async () => {
  const fetcher = vi.fn(async (url: string) => {
    const slugs = new URL(url, "http://test").searchParams.getAll("slug")
    expect(slugs.length).toBeLessThanOrEqual(24)

    return Response.json({
      data: {
        eligibility: Object.fromEntries(slugs.map((slug) => [slug, true])),
      },
    })
  })
  vi.stubGlobal("fetch", fetcher)
  const slugs = Array.from({ length: 30 }, (_, index) => `story-${index}`)
  const result = await fetchJournalOwnership(slugs)
  expect(Object.keys(result)).toHaveLength(30)
  expect(result["story-29"]).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
