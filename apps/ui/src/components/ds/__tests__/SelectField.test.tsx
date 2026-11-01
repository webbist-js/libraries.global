// @vitest-environment happy-dom
import { useState } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { SelectField } from "@/components/ds/SelectField"
import { cleanup, fireEvent, render, screen } from "@/test/render"

afterEach(cleanup)

const options = [
  { value: "", label: "All countries" },
  { value: "gb", label: "United Kingdom" },
  { value: "fr", label: "France" },
  { value: "unavailable", label: "Unavailable", disabled: true },
]

function choose(label: string) {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: label }))
}

it("submits raw values, clears filters and resets an uncontrolled form", () => {
  const { container } = render(
    <form>
      <label>
        Country
        <SelectField name="country" defaultValue="gb" options={options} />
      </label>
      <button type="reset">Reset</button>
    </form>
  )
  const form = container.querySelector("form")!
  expect(screen.getByRole("combobox", { name: "Country" })).toBeTruthy()
  expect(new FormData(form).get("country")).toBe("gb")
  choose("France")
  expect(new FormData(form).get("country")).toBe("fr")
  choose("All countries")
  expect(new FormData(form).get("country")).toBe("")
  fireEvent.click(screen.getByRole("button", { name: "Reset" }))
  expect(new FormData(form).get("country")).toBe("gb")
})

it("keeps controlled selection and exposes disabled options", () => {
  function Field() {
    const [value, setValue] = useState("")

    return (
      <SelectField
        label="Country"
        value={value}
        onValueChange={setValue}
        options={options}
      />
    )
  }
  render(<Field />)
  choose("France")
  expect(screen.getByRole("combobox").textContent).toContain("France")
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })
  expect(
    screen
      .getByRole("option", { name: "Unavailable" })
      .getAttribute("aria-disabled")
  ).toBe("true")
})

it("lets a command picker stay empty so the same action can be repeated", () => {
  const change = vi.fn()
  render(
    <SelectField
      label="Copy to"
      value=""
      onValueChange={change}
      options={options}
    />
  )
  choose("France")
  choose("France")
  expect(change).toHaveBeenCalledTimes(2)
  expect(change).toHaveBeenLastCalledWith("fr")
})

it("omits disabled fields from form submissions", () => {
  const { container } = render(
    <form>
      <SelectField
        label="Country"
        name="country"
        value="gb"
        options={options}
        disabled
      />
    </form>
  )
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(
    true
  )
  expect(new FormData(container.querySelector("form")!).has("country")).toBe(
    false
  )
})
