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
function mount(mode: "contact" | "feedback" = "feedback") {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(
    Response.json({ ok: true, reference: "12345678-reference" })
  )
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContactModal
        intent={
          mode === "feedback"
            ? { mode }
            : { mode, type: "plans", sourceSubject: "Team plan" }
        }
        context={context}
        trigger={null}
        onClose={close}
      />
    </NextIntlClientProvider>
  )
}
function questions() {
  fireEvent.change(screen.getByLabelText("What were you here to do?"), {
    target: { value: "find_library" },
  })
  fireEvent.change(screen.getByLabelText("Did you manage to do it?"), {
    target: { value: "no" },
  })
  fireEvent.click(screen.getByLabelText("2 out of 5"))
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
  it("closes on Escape", () => {
    mount()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(close).toHaveBeenCalled()
  })
})
