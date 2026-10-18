// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useModerationSummary } from "@/hooks/useModerationSummary"
import { cleanup, render, screen, waitFor } from "@/test/render"

const state = vi.hoisted(() => ({
  user: {
    id: "reviewer-a",
    moderationScopes: [{ queue: "all", locale: null as string | null }],
  },
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: { user: state.user } }),
}))
const clients: QueryClient[] = []

function Summary() {
  const query = useModerationSummary(true)

  return (
    <p>
      {query.isPending
        ? "Checking"
        : (query.data
            ?.map((row) => `${row.id}: ${row.pending ?? "unknown"}`)
            .join(", ") ?? "Unavailable")}
    </p>
  )
}
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={clients.at(-1)!}>
      {children}
    </QueryClientProvider>
  )
}
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.unstubAllGlobals()
  state.user = {
    id: "reviewer-a",
    moderationScopes: [{ queue: "all", locale: null }],
  }
})

describe("review summary cache", () => {
  it.each(["account", "scope"])(
    "does not reuse private counts after an %s change",
    async (change) => {
      clients.push(
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      )
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ data: [{ id: "discussions", pending: 7 }] })
        )
        .mockImplementationOnce(() => new Promise(() => {}))
      vi.stubGlobal("fetch", fetcher)
      const view = render(<Summary />, { wrapper })
      await screen.findByText("discussions: 7")
      state.user =
        change === "account"
          ? { ...state.user, id: "reviewer-b" }
          : {
              ...state.user,
              moderationScopes: [{ queue: "discussions", locale: "fr" }],
            }
      view.rerender(<Summary />)
      expect(screen.getByText("Checking")).toBeTruthy()
      expect(screen.queryByText("discussions: 7")).toBeNull()
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    }
  )

  it.each([
    null,
    { data: [null] },
    { data: [{ id: "discussions", pending: -1 }] },
  ])("treats a malformed response as unavailable", async (body) => {
    clients.push(
      new QueryClient({ defaultOptions: { queries: { retry: false } } })
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body))
    )
    render(<Summary />, { wrapper })
    expect(await screen.findByText("Unavailable")).toBeTruthy()
  })
})
