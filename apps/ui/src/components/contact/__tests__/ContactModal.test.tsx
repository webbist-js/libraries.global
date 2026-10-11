// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import ContactModal from "../ContactModal"

import messages from "../../../../locales/en.json"

const fetchMock = vi.fn()
const close = vi.fn()
const context = {
  page: "/map",
  locale: "en" as const,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
}
function mount(mode: "contact" | "feedback" | "atlas" = "feedback") {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(
    Response.json({ ok: true, reference: "12345678-reference" })
  )
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContactModal
        intent={
          mode === "contact"
            ? { mode, type: "plans", sourceSubject: "Team plan" }
            : mode === "atlas"
              ? { mode: "feedback", product: "atlas" }
              : { mode }
        }
        context={context}
        trigger={null}
        onClose={close}
      />
    </NextIntlClientProvider>
  )
}
function questions(atlas = false) {
  fireEvent.change(
    screen.getByLabelText(
      atlas ? "What were you using Atlas to do?" : "What were you here to do?"
    ),
    {
      target: { value: "find_library" },
    }
  )
  fireEvent.change(screen.getByLabelText("Did you manage to do it?"), {
    target: { value: "no" },
  })
  fireEvent.click(screen.getByLabelText("2 out of 5"))
  if (atlas) fireEvent.click(screen.getByRole("checkbox", { name: "Search" }))
  fireEvent.click(screen.getByRole("button", { name: "Continue" }))
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("guided feedback and contact modal", () => {
  it("submits anonymous task feedback with captured context and shows a reference", async () => {
    mount()
    expect(
      screen
        .getByRole("dialog", { name: "How did it go?" })
        .getAttribute("aria-modal")
    ).toBe("true")
    questions()
    fireEvent.change(screen.getByRole("textbox", { name: /What happened/ }), {
      target: { value: "The map did not show any libraries." },
    })
    fireEvent.change(
      screen.getByRole("textbox", { name: /How can we reproduce/ }),
      { target: { value: "1. Open map\n2. Zoom in" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(payload).toMatchObject({
      mode: "feedback",
      topic: "problem",
      task: "find_library",
      outcome: "no",
      ease: 2,
      email: "",
      context,
    })
    expect(payload).not.toHaveProperty("atlas")
    expect(
      await screen.findByRole("heading", {
        name: "Thanks for getting in touch.",
      })
    ).toBeTruthy()
    expect(screen.getByText("Reference: 12345678")).toBeTruthy()
  })
  it("retains the complete draft after failure and while going back to the questions", async () => {
    mount()
    questions()
    fetchMock.mockResolvedValue(
      Response.json({ error: "unavailable" }, { status: 503 })
    )
    const message = "Clicking on a library did not open it."
    fireEvent.change(screen.getByRole("textbox", { name: /What happened/ }), {
      target: { value: message },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(
      (
        screen.getByRole("textbox", {
          name: /What happened/,
        }) as HTMLTextAreaElement
      ).value
    ).toBe(message)
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(
      (screen.getByLabelText("What were you here to do?") as HTMLSelectElement)
        .value
    ).toBe("find_library")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      (
        screen.getByRole("textbox", {
          name: /What happened/,
        }) as HTMLTextAreaElement
      ).value
    ).toBe(message)
  })
  it("prefills the contact purpose, adapts the prompt and requires a reply email", async () => {
    mount("contact")
    expect(
      (screen.getByLabelText("What’s your message about?") as HTMLSelectElement)
        .value
    ).toBe("plans")
    expect(screen.getByText("Team plan")).toBeTruthy()
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).required
    ).toBe(true)
    fireEvent.change(screen.getByLabelText("What’s your message about?"), {
      target: { value: "report_issue" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: /What went wrong/ }), {
      target: { value: "I cannot open the plans page." },
    })
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.org" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      mode: "contact",
      type: "report_issue",
      sourceSubject: "Team plan",
      email: "reader@example.org",
    })
  })
  it("asks about Atlas features and submits a feature-specific draft and wishes", async () => {
    mount("atlas")
    expect(
      screen.getByRole("dialog", { name: "How was Atlas for you?" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("option", { name: "Manage my library" })
    ).toBeNull()
    fireEvent.change(
      screen.getByLabelText("What were you using Atlas to do?"),
      {
        target: { value: "compare_areas" },
      }
    )
    fireEvent.change(screen.getByLabelText("Did you manage to do it?"), {
      target: { value: "partly" },
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Map layers and keys" })
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "Area comparison" }))
    fireEvent.click(screen.getByLabelText("3 out of 5"))
    fireEvent.click(screen.getByLabelText("Clarity: 2 out of 5"))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    const message = "The map key was hard to understand when comparing areas."
    const wishlist = "I’d like a layer showing opening hours for each library."
    fireEvent.change(
      screen.getByRole("textbox", { name: /What happened in Atlas/ }),
      {
        target: { value: message },
      }
    )
    fireEvent.change(
      screen.getByRole("textbox", { name: /Things I’d like to see/ }),
      {
        target: { value: wishlist },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      mode: "feedback",
      topic: "problem",
      task: "compare_areas",
      outcome: "partly",
      ease: 3,
      message,
      atlas: {
        features: ["map_layers", "area_comparison"],
        clarity: 2,
        wishlist,
      },
    })
  })
  it("requires a feature selection and moves focus to the checkbox group", async () => {
    mount("atlas")
    fireEvent.change(
      screen.getByLabelText("What were you using Atlas to do?"),
      {
        target: { value: "explore" },
      }
    )
    fireEvent.change(screen.getByLabelText("Did you manage to do it?"), {
      target: { value: "browsing" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose at least one part of Atlas, or Other."
    )
    expect(fetchMock).not.toHaveBeenCalled()
    const search = screen.getByRole("checkbox", { name: "Search" })
    await waitFor(() => expect(document.activeElement).toBe(search))
    fireEvent.click(screen.getByRole("checkbox", { name: "Other" }))
    expect(screen.queryByRole("alert")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      screen.getByRole("textbox", { name: /What happened in Atlas/ })
    ).toBeTruthy()
  })
  it("asks for Atlas ideas once without a duplicate wishes field", async () => {
    mount("atlas")
    fireEvent.click(screen.getByRole("radio", { name: "I have an idea" }))
    questions(true)
    const idea = screen.getByRole("textbox", {
      name: /Things I’d like to see in Atlas/,
    }) as HTMLTextAreaElement
    expect(idea.maxLength).toBe(5000)
    expect(
      screen.getAllByRole("textbox", { name: /Things I’d like to see/ })
    ).toHaveLength(1)
    const message = "I’d like to compare library opening hours on the map."
    fireEvent.change(idea, { target: { value: message } })
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      topic: "idea",
      message,
      atlas: { features: ["search"] },
    })
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1].body).atlas
    ).not.toHaveProperty("wishlist")
  })
  it("keeps a long Atlas draft valid when switching to the idea topic", async () => {
    mount("atlas")
    questions(true)
    const message = "I’d like to see more detail about libraries. ".repeat(60)
    fireEvent.change(
      screen.getByRole("textbox", { name: /What happened in Atlas/ }),
      {
        target: { value: message },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    fireEvent.click(screen.getByRole("radio", { name: "I have an idea" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      (
        screen.getByRole("textbox", {
          name: /Things I’d like to see in Atlas/,
        }) as HTMLTextAreaElement
      ).value
    ).toBe(message)
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      topic: "idea",
      message: message.trim(),
      atlas: { features: ["search"] },
    })
  })
  it("retains Atlas answers, feature choices and wishes after failure and going back", async () => {
    mount("atlas")
    fireEvent.click(screen.getByLabelText("Clarity: 4 out of 5"))
    questions(true)
    fetchMock.mockResolvedValue(
      Response.json({ error: "unavailable" }, { status: 503 })
    )
    const message = "The search did not find the library I expected."
    const wishlist = "I’d like to search by opening hours too."
    fireEvent.change(
      screen.getByRole("textbox", { name: /What happened in Atlas/ }),
      {
        target: { value: message },
      }
    )
    fireEvent.change(
      screen.getByRole("textbox", { name: /Things I’d like to see/ }),
      {
        target: { value: wishlist },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(await screen.findByRole("alert")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(
      (screen.getByRole("checkbox", { name: "Search" }) as HTMLInputElement)
        .checked
    ).toBe(true)
    expect(
      (screen.getByLabelText("Clarity: 4 out of 5") as HTMLInputElement).checked
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      (
        screen.getByRole("textbox", {
          name: /What happened in Atlas/,
        }) as HTMLTextAreaElement
      ).value
    ).toBe(message)
    expect(
      (
        screen.getByRole("textbox", {
          name: /Things I’d like to see/,
        }) as HTMLTextAreaElement
      ).value
    ).toBe(wishlist)
  })
  it("closes on Escape", () => {
    mount()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(close).toHaveBeenCalled()
  })
})
