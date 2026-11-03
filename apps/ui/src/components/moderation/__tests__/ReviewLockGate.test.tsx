// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { ReviewLockGate } = await import("../ReviewLockGate")

const reply = (data: unknown) => Response.json({ data })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("pauses the decision controls while someone else reviews, until taking over", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { action } = JSON.parse(String(init?.body))

    return action === "takeover"
      ? reply({ state: "mine", holderName: "Me" })
      : action === "acquire"
        ? reply({ state: "held", holderName: "Sam" })
        : reply({ state: "free" })
  })
  vi.stubGlobal("fetch", fetchMock)
  render(
    <ReviewLockGate documentId="s0000000000000000000001" active>
      <button type="button">Approve</button>
    </ReviewLockGate>
  )

  expect(
    await screen.findByText("Sam is reviewing this submission.")
  ).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement)
      .closest("fieldset")!
      .hasAttribute("disabled")
  ).toBe(true)

  fireEvent.click(screen.getByRole("button", { name: "Take over" }))
  fireEvent.click(screen.getByRole("button", { name: "Take over review" }))
  expect(await screen.findByText(/You’re reviewing this/)).toBeTruthy()
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Approve" })
        .closest("fieldset")!
        .hasAttribute("disabled")
    ).toBe(false)
  )
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/moderation/locks/s0000000000000000000001",
    expect.objectContaining({ body: JSON.stringify({ action: "takeover" }) })
  )
})

it("leaves a decided submission unlocked and asks nothing", () => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  render(
    <ReviewLockGate documentId="s0000000000000000000001" active={false}>
      <button type="button">Approve</button>
    </ReviewLockGate>
  )
  expect(fetchMock).not.toHaveBeenCalled()
  expect(
    screen
      .getByRole("button", { name: "Approve" })
      .closest("fieldset")!
      .hasAttribute("disabled")
  ).toBe(false)
})
