// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { Button } from "./button"

afterEach(cleanup)
it("keeps the original action name and prevents duplicate submission while loading", () => {
  const onClick = vi.fn()
  const { rerender } = render(
    <Button isLoading onClick={onClick}>
      Save changes
    </Button>
  )
  const button = screen.getByRole("button", {
    name: "Save changes",
  }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(button.getAttribute("aria-busy")).toBe("true")
  fireEvent.click(button)
  expect(onClick).not.toHaveBeenCalled()
  rerender(<Button onClick={onClick}>Save changes</Button>)
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
  expect(onClick).toHaveBeenCalledOnce()
})
it("keeps a single link child and marks an unavailable slotted action inert", () => {
  render(
    <Button asChild isLoading>
      <a href="https://example.invalid/guide">Read guide</a>
    </Button>
  )
  const link = screen.getByRole("link", { name: "Read guide" })
  expect(link.getAttribute("href")).toBe("https://example.invalid/guide")
  expect(link.hasAttribute("inert")).toBe(true)
  expect(link.getAttribute("aria-disabled")).toBe("true")
  expect(link.querySelectorAll("a").length).toBe(0)
})
