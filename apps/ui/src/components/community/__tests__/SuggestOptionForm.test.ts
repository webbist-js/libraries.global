// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  PublicSuggestion,
  SuggestionList,
} from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { SuggestOptionForm } = await import("../SuggestOptionForm")

const optionNames: Record<SuggestionList, string[]> = {
  accessibility: ["Hearing loop", "Step-free access"],
  amenities: ["Free Wi-Fi"],
  services: ["Printing"],
  library_types: ["Public"],
}

const suggestion = (
  overrides: Partial<PublicSuggestion> = {}
): PublicSuggestion => ({
  documentId: "s1",
  name: "Seed library",
  optionKey: "services",
  status: "open",
  votes: 4,
  description: null,
  suggestedByName: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  ...overrides,
})

function renderForm(
  props: Partial<Parameters<typeof SuggestOptionForm>[0]> = {}
) {
  const onPosted = vi.fn()
  render(
    createElement(SuggestOptionForm, {
      signedIn: true,
      optionNames,
      suggestions: [suggestion()],
      onPosted,
      ...props,
    })
  )

  return { onPosted }
}

const nameInput = () =>
  screen.getByRole("textbox", { name: /Option name/ }) as HTMLInputElement
const listSelect = () =>
  screen.getByRole("combobox", { name: "Which list?" }) as HTMLSelectElement
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Post suggestion" }))

describe("SuggestOptionForm", () => {
  it("asks for a name before posting", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderForm()

    fireEvent.change(nameInput(), { target: { value: "   " } })
    submit()

    expect(screen.getByText("Give the option a short name.")).toBeTruthy()
    expect(nameInput().getAttribute("aria-invalid")).toBe("true")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses a name already in the list, ignoring case", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderForm()

    fireEvent.change(nameInput(), { target: { value: "hearing  LOOP " } })
    submit()

    expect(
      screen.getByText("That option already exists or has been suggested.")
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses a name already suggested for that list", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderForm()

    fireEvent.change(listSelect(), { target: { value: "services" } })
    fireEvent.change(nameInput(), { target: { value: "Seed Library" } })
    submit()

    expect(
      screen.getByText("That option already exists or has been suggested.")
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the server’s message on a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              message:
                "Someone has already suggested this. Vote for it instead.",
            },
          },
          { status: 409 }
        )
      )
    )
    const { onPosted } = renderForm()

    fireEvent.change(nameInput(), { target: { value: "Tool lending" } })
    submit()

    expect(
      await screen.findByText(
        "Someone has already suggested this. Vote for it instead."
      )
    ).toBeTruthy()
    expect(nameInput().getAttribute("aria-invalid")).toBe("true")
    expect(onPosted).not.toHaveBeenCalled()
  })

  it("shows a plain-string error from the Next layer on a 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        )
      )
    )
    renderForm()

    fireEvent.change(nameInput(), { target: { value: "Tool lending" } })
    submit()

    expect(
      await screen.findByText("Too many requests. Please try again later.")
    ).toBeTruthy()
  })

  it("posts, hands the new suggestion back and confirms", async () => {
    const posted = suggestion({
      documentId: "new1",
      name: "Tool lending",
      votes: 1,
      voted: true,
      description: "Drills on loan.",
    })
    const fetchMock = vi.fn(async () =>
      Response.json({ data: posted }, { status: 201 })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { onPosted } = renderForm()

    fireEvent.change(listSelect(), { target: { value: "services" } })
    fireEvent.change(nameInput(), { target: { value: " Tool lending " } })
    fireEvent.change(screen.getByRole("textbox", { name: /Why it matters/ }), {
      target: { value: "Drills on loan." },
    })
    submit()

    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(posted))
    expect(fetchMock).toHaveBeenCalledWith("/api/option-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        optionKey: "services",
        name: "Tool lending",
        description: "Drills on loan.",
      }),
    })
    expect(screen.getByRole("status").textContent).toBe(
      "Posted, with your vote."
    )
    expect(nameInput().value).toBe("")
    expect(nameInput().getAttribute("aria-invalid")).toBeNull()
  })

  it("asks a signed-out viewer to sign in", () => {
    renderForm({ signedIn: false })

    expect(screen.getByText("Sign in to suggest an option.")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community/suggestions#suggest-option")}`
    )
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})
