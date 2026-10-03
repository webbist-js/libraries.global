// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

const fetchMock = vi.fn()
const { ModerationQueue } = await import("../ModerationQueue")

const renderQueue = () =>
  render(
    createElement(ModerationQueue, {
      state: { segment: "pending", queue: "", locale: "", q: "", page: 1 },
      queues: ["index"],
      locales: [],
      localeNames: {},
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

const answer = (status: number) =>
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/stats")
      ? Response.json({ data: [] })
      : Response.json({ error: { status, name: "conflict" } }, { status })
  )

describe("ModerationQueue errors", () => {
  it("403: says the queue is out of reach", async () => {
    answer(403)
    renderQueue()
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "You don't have access to this queue."
      )
    )
  })

  it.each([404, 409, 500])(
    "%s: a plain load failure, not decision copy",
    async (s) => {
      answer(s)
      renderQueue()
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toBe(
          "The queue couldn't be loaded. Try again."
        )
      )
    }
  )
})
