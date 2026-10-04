// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href }, children),
  useRouter: () => ({ push: vi.fn() }),
}))
// No WebGL here: the Location step's map shows its fallback note.
vi.mock("maplibre-gl", () => ({
  default: {
    Map: class {
      constructor() {
        throw new Error("WebGL unavailable")
      }
    },
  },
}))
const mutation = () => ({ mutate: vi.fn(), isPending: false })
vi.mock("@/hooks/useSubmissions", () => ({
  useCreateSubmission: mutation,
  useFinalizeDraft: mutation,
  useSaveDraft: mutation,
  useResumeDraft: () => ({ data: undefined }),
}))

const { IndexRecordWizard } = await import("../IndexRecordWizard")
const { STEP_COMPONENTS } = await import("../WizardSteps")
const { EMPTY_FORM } = await import("../wizard.types")
const { requiredFields } = await import("../wizard.validation")

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: [] }))
  )
})
afterEach(cleanup)

const nextButton = () => screen.getByRole("button", { name: /^Next:/ })
const errorIds = () =>
  [...document.querySelectorAll('[aria-invalid="true"]')].map((el) => el.id)

describe("the steps' required markers", () => {
  it.each([false, true])(
    "match the validation rules (improving: %s)",
    (improving) => {
      STEP_COMPONENTS.forEach((Step, i) => {
        const { unmount } = render(
          createElement(Step, {
            f: EMPTY_FORM,
            set: () => {},
            setFormData: () => {},
            improving,
          })
        )
        const marked = [
          ...document.querySelectorAll('[aria-required="true"]'),
        ].map((el) => el.id)
        expect(marked.sort(), `step ${i + 1}`).toEqual(
          requiredFields(i + 1, improving).sort()
        )
        unmount()
      })
    }
  )
})

describe("IndexRecordWizard", () => {
  it("holds a step until its required fields are filled, flagging them on the field", () => {
    render(
      createElement(IndexRecordWizard, {
        mode: "new",
        initialData: { libraryType: "Public", operationalStatus: "open" },
      })
    )
    expect(errorIds()).toEqual([])

    fireEvent.click(nextButton())

    expect(
      screen.getByRole("heading", { name: "What library is this?" })
    ).toBeTruthy()
    expect(errorIds()).toEqual(["name"])
    expect(document.activeElement?.id).toBe("name")
    expect(screen.getByText("Fill this in to continue.")).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Library name/), {
      target: { value: "Radlett Library" },
    })
    expect(errorIds()).toEqual([])

    fireEvent.click(nextButton())

    expect(screen.getByRole("heading", { name: "Where is it?" })).toBeTruthy()
    expect(errorIds()).toEqual([])
  })

  it("holds the Location step on a coordinate out of range, and splits a pasted pair", () => {
    render(
      createElement(IndexRecordWizard, {
        mode: "new",
        initialData: {
          name: "Radlett Library",
          libraryType: "Public",
          operationalStatus: "open",
          city: "Radlett",
          country: "England",
        },
      })
    )
    fireEvent.click(nextButton())
    expect(screen.getByRole("heading", { name: "Where is it?" })).toBeTruthy()

    const latitude = () =>
      screen.getByLabelText(/^Latitude/) as HTMLInputElement
    fireEvent.change(latitude(), { target: { value: "200" } })
    fireEvent.click(nextButton())
    expect(errorIds()).toEqual(["lat"])
    expect(
      screen.getByText("Latitude is a number between -90 and 90.")
    ).toBeTruthy()

    fireEvent.paste(latitude(), {
      clipboardData: { getData: () => "51.7031, -0.3255" },
    })
    expect(latitude().value).toBe("51.7031")
    expect(
      (screen.getByLabelText(/^Longitude/) as HTMLInputElement).value
    ).toBe("-0.3255")
    expect(errorIds()).toEqual([])

    fireEvent.click(nextButton())
    expect(
      screen.getByRole("heading", { name: "How do people visit?" })
    ).toBeTruthy()
  })
})
