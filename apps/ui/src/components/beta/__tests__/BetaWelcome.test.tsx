// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import BetaWelcome from "../BetaWelcome"

const openFeedback = vi.fn()
vi.mock("@/components/contact/ContactModalProvider", () => ({
  useContactModal: () => ({ openFeedback }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({
      href,
      children,
      onClick,
    }: {
      href: string
      children: React.ReactNode
      onClick?: () => void
    }) => createElement("a", { href, onClick }, children),
  }
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe("beta welcome", () => {
  it("explains testing, the Team API pool and the data wipe with a dismissible dialog", () => {
    const close = vi.fn()
    render(<BetaWelcome sandbox onClose={close} />)
    expect(
      screen.getByRole("dialog", { name: "Welcome to the beta." })
    ).toBeTruthy()
    expect(screen.getByText("4242 4242 4242 4242")).toBeTruthy()
    expect(screen.getByText(/Beta data will be wiped/)).toBeTruthy()
    expect(
      screen.getByText(/Keys share one monthly Team allowance/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Start testing" }))
    expect(close).toHaveBeenCalledOnce()
  })
  it("opens the existing feedback flow after dismissing the welcome", () => {
    const close = vi.fn()
    render(<BetaWelcome sandbox onClose={close} />)
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(close).toHaveBeenCalledOnce()
    expect(openFeedback).toHaveBeenCalledOnce()
  })
  it("never supplies a test card or claims payment is free in a live billing environment", () => {
    render(<BetaWelcome sandbox={false} onClose={vi.fn()} />)
    expect(screen.queryByText("4242 4242 4242 4242")).toBeNull()
    expect(screen.queryByText(/no real payment is taken/)).toBeNull()
    expect(screen.getByText(/Payment testing is unavailable/)).toBeTruthy()
  })
})
