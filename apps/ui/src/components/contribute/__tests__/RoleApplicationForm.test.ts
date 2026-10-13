// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

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
  { code: "en", label: "English" },
  { code: "fr", label: "French · Français" },
]

const NONE = {
  wiki_editor: [],
  journal_editor: [],
  moderator: { index: [], knowledge: [], journal: [] },
}

const renderForm = (over: Record<string, unknown> = {}) =>
  render(
    createElement(RoleApplicationForm, {
      acceptedCount: 5,
      locales: LOCALES,
      initialLocales: [],
      initialRole: "wiki_editor",
      applications: [],
      accepted: [],
      acceptedTotal: 5,
      username: "ada",
      wikiSections: [{ slug: "contributing", name: "Contributing" }],
      blogSections: [{ slug: "field-notes", name: "Field notes" }],
      held: NONE,
      guidelines: {
        editor: "/knowledge/contributing/how-to-contribute",
        moderator: "/knowledge/governance/how-review-works",
      },
      ...over,
    } as Parameters<typeof RoleApplicationForm>[0])
  )

const STATEMENT = "I have corrected dozens of library records."

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ]

  return { url, method: init.method, body: JSON.parse(String(init.body)) }
}

const fillAndSend = () => {
  fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
    target: { value: `  ${STATEMENT}  ` },
  })
  fireEvent.click(screen.getByLabelText(/I’ve read the/))
  fireEvent.click(screen.getByRole("button", { name: /Send application/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("RoleApplicationForm", () => {
  it("shows progress and disables the form below five accepted changes", () => {
    renderForm({ acceptedCount: 3 })
    expect(screen.getByText("3 accepted changes")).toBeTruthy()
    expect(screen.getByText("Not yet")).toBeTruthy()
    const bar = screen.getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("3")
    expect(bar.getAttribute("aria-valuemax")).toBe("5")
    expect(
      screen.getByText(
        /Keep contributing: corrections, new libraries and photos all count\./
      )
    ).toBeTruthy()
    const submit = screen.getByRole("button", { name: /Send application/ })
    expect(submit.closest("fieldset[disabled]")).toBeTruthy()
  })

  it("preselects the role from the query", () => {
    renderForm({ initialRole: "journal_editor" })
    expect(
      (screen.getByLabelText(/Journal editor/) as HTMLInputElement).checked
    ).toBe(true)
    expect(screen.getByText("What a journal editor can do")).toBeTruthy()
  })

  it("sends an editor application with the shared field contract", async () => {
    renderForm()
    fireEvent.click(screen.getByLabelText("French · Français"))
    fireEvent.click(screen.getByLabelText("Contributing"))
    fireEvent.change(screen.getByLabelText("Sample link 1"), {
      target: { value: "https://example.org/my-edit" },
    })
    fillAndSend()

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
          sections: ["contributing"],
          statement: STATEMENT,
          samples: ["https://example.org/my-edit"],
          acceptedGuidelines: true,
        },
      },
    })
    await waitFor(() =>
      expect(screen.getByText(/Application sent/)).toBeTruthy()
    )
  })

  it("asks a moderator applicant for a queue and sends it", async () => {
    renderForm({ initialRole: "moderator" })
    fillAndSend()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/queue/)

    fireEvent.click(screen.getByLabelText("Index (library records)"))
    // No section list for the Index queue.
    expect(screen.queryByText(/sections you’d work on/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Send application/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent().body.fields).toEqual({
      role: "moderator",
      queue: "index",
      locales: [],
      statement: STATEMENT,
      samples: [],
      acceptedGuidelines: true,
    })
  })

  it("needs the guidelines confirmed", () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/Why you’re applying/), {
      target: { value: STATEMENT },
    })
    fireEvent.click(screen.getByRole("button", { name: /Send application/ }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/guidelines/)
  })

  it("preselects profile languages", () => {
    renderForm({ initialLocales: ["fr"] })
    expect(
      (screen.getByLabelText("French · Français") as HTMLInputElement).checked
    ).toBe(true)
    expect(
      (screen.getByLabelText("Any language") as HTMLInputElement).checked
    ).toBe(false)
  })

  it("shows the server's reason when it refuses", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { message: "You already have this role." } },
        { status: 403 }
      )
    )
    renderForm()
    fillAndSend()
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /already have this role/
      )
    )
  })

  it("shows an open application instead of the form", () => {
    renderForm({
      applications: [
        {
          documentId: "a1",
          role: "wiki_editor",
          queue: null,
          status: "needs_info",
          locales: [],
          reviewNote: "Please add a sample of your work.",
          createdAt: "2026-10-01T00:00:00Z",
          decidedAt: null,
        },
      ],
    })
    expect(screen.getByText(/already have an application/)).toBeTruthy()
    expect(screen.getByText(/Please add a sample of your work\./)).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: /Send application/ })
    ).toBeNull()
  })

  it("shows when a rejected applicant may apply again", () => {
    renderForm({
      applications: [
        {
          documentId: "a2",
          role: "wiki_editor",
          queue: null,
          status: "rejected",
          locales: [],
          reviewNote: "Not this time.",
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        },
      ],
    })
    expect(
      screen.getByText(/You can apply for this role again on/)
    ).toBeTruthy()
    expect(screen.getByText(/Not this time\./)).toBeTruthy()
  })

  it("says so when the role is already held", () => {
    renderForm({ held: { ...NONE, wiki_editor: "all" } })
    expect(screen.getByText("You’re already a Knowledge editor.")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Open the Knowledge editor" })
        .getAttribute("href")
    ).toBe("/contribute/knowledge")
  })

  it("never mentions Pro or paying", () => {
    const { container } = renderForm({ acceptedCount: 2 })
    expect(container.textContent).not.toMatch(/\bPro\b|pay|plan\b|price/i)
  })
})
