// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { afterEach, describe, expect, it } from "vitest"

import { Form } from "@/components/ui/form"

import { AppField } from "./AppField"

afterEach(cleanup)
function Example({ id }: { id?: string }) {
  const form = useForm({ defaultValues: { name: "" } })

  return (
    <Form {...form}>
      <AppField
        name="name"
        id={id}
        label="Library name"
        description="Use the published name."
        endAdornment="Library"
      />
      <button
        onClick={() => form.setError("name", { message: "Enter a name." })}
      >
        Validate
      </button>
    </Form>
  )
}
describe("AppField input contract", () => {
  for (const id of [undefined, "custom-library-name"]) {
    it(`binds the actual input, help and error with ${id ?? "generated ID"}`, async () => {
      render(<Example id={id} />)
      const input = screen.getByRole("textbox", { name: "Library name" })
      expect(screen.getByLabelText("Library name")).toBe(input)
      expect(input.tagName).toBe("INPUT")
      if (id) expect(input.id).toBe(id)
      const helpId = input.getAttribute("aria-describedby")!
      expect(document.getElementById(helpId)?.textContent).toBe(
        "Use the published name."
      )
      await act(async () => fireEvent.click(screen.getByText("Validate")))
      expect(input.getAttribute("aria-invalid")).toBe("true")
      const descriptions = input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((key) => document.getElementById(key)?.textContent)
      expect(descriptions).toEqual(["Use the published name.", "Enter a name."])
    })
  }
})
