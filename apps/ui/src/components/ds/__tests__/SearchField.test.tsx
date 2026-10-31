// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { SearchField } from "../SearchField"

vi.mock("next-intl", () => ({ useTranslations: () => String }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
afterEach(cleanup)
it("preserves native input variation while binding the shared label", () => {
  render(
    <SearchField
      id="city"
      placeholder="Search libraries"
      inputProps={{
        type: "text",
        placeholder: "City",
        className: "custom-input",
        autoComplete: "off",
      }}
    />
  )
  const input = screen.getByRole("textbox", { name: "Search libraries" })
  expect(input.getAttribute("placeholder")).toBe("City")
  expect(input.className).toContain("custom-input")
  expect(input.getAttribute("autocomplete")).toBe("off")
})
it("keeps a supplied input ID and its label bound, without enabling disabled clearing", () => {
  const onClear = vi.fn()
  render(
    <SearchField
      id="default"
      placeholder="Search libraries"
      onClear={onClear}
      loading
      inputProps={{
        id: "specific",
        disabled: true,
        value: "Library",
        onChange: vi.fn(),
      }}
    />
  )
  const input = screen.getByRole("searchbox", { name: "Search libraries" })
  expect(input.id).toBe("specific")
  expect(input.getAttribute("aria-busy")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "clear_search" }))
  expect(onClear).not.toHaveBeenCalled()
})
