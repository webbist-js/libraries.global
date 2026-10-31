// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { afterEach, describe, expect, it } from "vitest"

import { Form } from "@/components/ui/form"

import { AppTextArea } from "./AppTextArea"

afterEach(cleanup)
function Example({
  id,
  nativeLabel = false,
}: {
  id?: string
  nativeLabel?: boolean
}) {
  const form = useForm({ defaultValues: { description: "" } })

  return (
    <Form {...form}>
      <AppTextArea
        name="description"
        id={id}
        label={nativeLabel ? undefined : "About the library"}
        aria-label={nativeLabel ? "Library description" : undefined}
        description="Describe the collections and services."
        placeholder="A welcoming place to read"
        rows={5}
        required
      />
      <button
        onClick={() =>
          form.setError("description", { message: "Enter a description." })
        }
      >
        Validate
      </button>
    </Form>
  )
}

describe("AppTextArea input contract", () => {
  for (const id of [undefined, "custom-library-description"]) {
    it(`binds label, native attributes, help and error to the textarea with ${id ?? "generated ID"}`, async () => {
      render(<Example id={id} />)
      const input = screen.getByRole("textbox", {
        name: "About the library",
      }) as HTMLTextAreaElement
      expect(screen.getByLabelText(/About the library/)).toBe(input)
      expect(input.tagName).toBe("TEXTAREA")
      if (id) expect(input.id).toBe(id)
      expect(input.required).toBe(true)
      expect(input.getAttribute("rows")).toBe("5")
      expect(input.placeholder).toBe("A welcoming place to read")
      expect(
        document.getElementById(input.getAttribute("aria-describedby")!)
          ?.textContent
      ).toBe("Describe the collections and services.")
      await act(async () => fireEvent.click(screen.getByText("Validate")))
      expect(input.getAttribute("aria-invalid")).toBe("true")
      const descriptions = input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((key) => document.getElementById(key)?.textContent)
      expect(descriptions).toEqual([
        "Describe the collections and services.",
        "Enter a description.",
      ])
    })
  }
  it("forwards a native accessible name when no visible label is supplied", () => {
    render(<Example nativeLabel />)
    expect(
      screen.getByRole("textbox", { name: "Library description" }).tagName
    ).toBe("TEXTAREA")
  })
})
