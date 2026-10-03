// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const fetchMock = vi.fn(async () =>
  Response.json({ data: { documentId: "newapp" } }, { status: 201 })
)

const { RoleApplicationForm } = await import("../RoleApplicationForm")

const LOCALES = [
  { code: "en", name: "English", isDefault: true },
  { code: "fr", name: "French" },
]

const renderForm = (over: Record<string, unknown> = {}) =>
  render(
    createElement(RoleApplicationForm, {
      acceptedCount: 5,
      locales: LOCALES,
      initialRole: null,
      applications: [],
      ...over,
    })
  )

const STATEMENT = "I have corrected dozens of library records."

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ]

  return { url, method: init.method, body: JSON.parse(String(init.body)) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("RoleApplicationForm", () => {
  it("shows progress and disables the form below five accepted changes", () => {
    renderForm({ acceptedCount: 3 })
    expect(screen.getByText("3 of 5 accepted changes")).toBeTruthy()
    const bar = screen.getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("3")
    expect(bar.getAttribute("aria-valuemax")).toBe("5")
    expect(
      screen.getByText(
        "Keep contributing: corrections and new libraries all count."
      )
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /contribute/i }).getAttribute("href")
    ).toBe("/contribute")
    const submit = screen.getByRole("button", { name: "Send application" })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByLabelText(/Why you’re applying/) as HTMLTextAreaElement)
        .disabled
    ).toBe(true)
  })

  it("preselects the role from the query", () => {
    renderForm({ initialRole: "journal_editor" })
    expect(
      (screen.getByLabelText(/Journal editor/) as HTMLInputElement).checked
    ).toBe(true)
  })

  it("sends a role application with the documented payload", async () => {
    renderForm({ initialRole: "wiki_editor" })
    fireEvent.click(screen.getByLabelText("French"))
    fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
      target: { value: `  ${STATEMENT}  ` },
    })
    fireEvent.change(screen.getByLabelText("Sample link 1"), {
      target: { value: "https://example.org/my-edit" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send application" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent()).toEqual({
      url: "/api/submissions",
      method: "POST",
      body: {
        submissionType: "role_application",
        targetEntityType: "user_profile",
        fields: {
          role: "wiki_editor",
          locales: ["fr"],
          statement: STATEMENT,
          samples: ["https://example.org/my-edit"],
        },
      },
    })
    await waitFor(() =>
      expect(screen.getByText(/Application sent/)).toBeTruthy()
    )
  })

  it("defaults to all languages", async () => {
    renderForm({ initialRole: "journal_editor" })
    expect(
      (screen.getByLabelText("All languages") as HTMLInputElement).checked
    ).toBe(true)
    fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
      target: { value: STATEMENT },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send application" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent().body.fields).toEqual({
      role: "journal_editor",
      locales: [],
      statement: STATEMENT,
      samples: [],
    })
  })

  it("refuses a statement outside 20 to 2000 characters", () => {
    renderForm({ initialRole: "wiki_editor" })
    const statement = screen.getByLabelText(/Why you’re applying/)
    fireEvent.change(statement, { target: { value: "Too short." } })
    expect(screen.getByText("10 / 2000")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Send application" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(
      /between 20 and 2000 characters/
    )

    fireEvent.change(statement, { target: { value: "x".repeat(2001) } })
    fireEvent.click(screen.getByRole("button", { name: "Send application" }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the server's reason when it refuses", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          error: {
            message: "You already hold this role for the languages you chose.",
          },
        },
        { status: 403 }
      )
    )
    renderForm({ initialRole: "wiki_editor" })
    fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
      target: { value: STATEMENT },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send application" }))
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /already hold this role/
      )
    )
  })

  it("shows an existing application with the moderator's note", () => {
    renderForm({
      initialRole: "wiki_editor",
      applications: [
        {
          documentId: "a1",
          role: "wiki_editor",
          status: "needs_info",
          locales: [],
          reviewNote: "Please add a sample of your work.",
          createdAt: "2026-10-01T00:00:00Z",
        },
        {
          documentId: "a2",
          role: "journal_editor",
          status: "rejected",
          locales: ["fr"],
          reviewNote: "Not this time.",
          createdAt: "2026-09-01T00:00:00Z",
        },
      ],
    })
    const list = screen.getByRole("list", { name: "Your applications" })
    expect(list.textContent).toMatch(/Knowledge editor/)
    expect(list.textContent).toMatch(/Needs more information/)
    expect(list.textContent).toMatch(/Please add a sample of your work\./)
    expect(list.textContent).toMatch(/Journal editor/)
    expect(list.textContent).toMatch(/Not accepted/)
    expect(list.textContent).toMatch(/Not this time\./)
  })

  it("won't send a second application while one is open for the role", () => {
    renderForm({
      initialRole: "wiki_editor",
      applications: [
        {
          documentId: "a1",
          role: "wiki_editor",
          status: "pending",
          locales: [],
          reviewNote: null,
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
    })
    fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
      target: { value: STATEMENT },
    })
    expect(
      (
        screen.getByRole("button", {
          name: "Send application",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(screen.getByText(/already have an application/)).toBeTruthy()
  })

  it("never mentions Pro or paying", () => {
    const { container } = renderForm({ acceptedCount: 2 })
    expect(container.textContent).not.toMatch(/\bPro\b|pay|plan\b|price/i)
  })
})
