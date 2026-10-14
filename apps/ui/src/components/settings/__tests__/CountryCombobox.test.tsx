// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { CountryCombobox } from "@/components/settings/CountryCombobox"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      search_countries: "Search countries",
      search_countries_2: "Search countries…",
      no_results: "No results",
    })[key],
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))
afterEach(cleanup)

const countries = [
  { code: "czechia", name: "Česko", searchTerms: "CZ CZE" },
  { code: "france", name: "France", searchTerms: "FR FRA" },
  { code: "germany", name: "Germany", searchTerms: "DE DEU" },
]
function Picker() {
  const [value, setValue] = useState("france")

  return (
    <CountryCombobox value={value} onChange={setValue} countries={countries} />
  )
}

it("keeps the standard country options for existing selectors", () => {
  const change = vi.fn()
  render(<CountryCombobox value="FR" onChange={change} />)
  fireEvent.click(screen.getByRole("button", { name: "France" }))
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "germany" },
  })
  fireEvent.click(screen.getByRole("option", { name: "Germany" }))
  expect(change).toHaveBeenCalledWith("DE")
})

it("searches custom names, identifiers and ISO codes without requiring accents", () => {
  render(<Picker />)
  fireEvent.click(screen.getByRole("button", { name: "France" }))
  const search = screen.getByRole("combobox")
  expect(document.activeElement).toBe(search)
  fireEvent.change(search, { target: { value: "cesko" } })
  expect(screen.getByRole("option", { name: "Česko" })).toBeTruthy()
  expect(screen.queryByRole("option", { name: "France" })).toBeNull()
  fireEvent.change(search, { target: { value: "DEU" } })
  fireEvent.keyDown(search, { key: "Enter" })
  expect(screen.queryByRole("combobox")).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Germany" })
  )
})

it("uses arrows to choose an option and Escape to return focus without changing value", () => {
  render(<Picker />)
  const trigger = screen.getByRole("button", { name: "France" })
  fireEvent.keyDown(trigger, { key: "ArrowDown" })
  const search = screen.getByRole("combobox")
  fireEvent.keyDown(search, { key: "ArrowUp" })
  expect(search.getAttribute("aria-activedescendant")).toBe(
    screen.getByRole("option", { name: "Germany" }).id
  )
  fireEvent.keyDown(search, { key: "Escape" })
  expect(document.activeElement).toBe(trigger)
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  fireEvent.click(trigger)
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" })
  expect(screen.getByRole("button", { name: "France" })).toBeTruthy()
})

it("handles an empty search and closes when keyboard focus leaves the selector", () => {
  render(
    <>
      <Picker />
      <button>After selector</button>
    </>
  )
  fireEvent.click(screen.getByRole("button", { name: "France" }))
  const search = screen.getByRole("combobox")
  fireEvent.change(search, { target: { value: "not a country" } })
  expect(screen.getByText("No results")).toBeTruthy()
  fireEvent.keyDown(search, { key: "Enter" })
  expect(screen.getByRole("combobox")).toBeTruthy()
  fireEvent.blur(search, {
    relatedTarget: screen.getByRole("button", { name: "After selector" }),
  })
  expect(screen.queryByRole("combobox")).toBeNull()
})
