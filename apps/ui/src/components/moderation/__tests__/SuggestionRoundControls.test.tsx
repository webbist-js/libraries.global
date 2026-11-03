// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}))

const { SuggestionRoundControls } = await import("../SuggestionRoundControls")

const round = {
  documentId: "round-1",
  version: 3,
  opensAt: "2026-10-01T00:00:00.000Z",
  cutoffAt: "2026-10-20T00:00:00.000Z",
  reviewAt: "2026-10-27T00:00:00.000Z",
  capacity: 5,
  state: "review" as const,
  shortlist: [
    {
      documentId: "s1",
      name: "Seed library",
      optionKey: "services" as const,
      votes: 5,
      rank: 1,
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("confirms before completing a round and suggests a drive", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ data: { ...round, state: "voting", version: 4 } })
  )
  vi.stubGlobal("fetch", fetchMock)
  render(<SuggestionRoundControls initial={round} />)

  fireEvent.click(screen.getByRole("button", { name: "Complete review" }))
  const dialog = await screen.findByRole("dialog", {
    name: "Complete this review round?",
  })
  expect(fetchMock).not.toHaveBeenCalled()
  expect(
    screen
      .getByRole("link", { name: "Plan a facilities drive" })
      .getAttribute("href")
  ).toBe("/community/propose?gaps=facilities")

  fireEvent.click(
    screen.getByRole("button", { name: "Complete and open voting" })
  )
  await waitFor(() => expect(dialog.isConnected).toBe(false))
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/moderation/suggestion-round",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ action: "close", version: 3 }),
    })
  )
})
