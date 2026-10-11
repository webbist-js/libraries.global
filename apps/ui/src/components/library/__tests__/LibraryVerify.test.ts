// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const session = vi.hoisted(() => ({
  value: { data: { user: { id: "u1" } }, isPending: false } as {
    data: { user: { id: string } } | null
    isPending: boolean
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session.value },
}))
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

const { LibraryVerify } = await import("../LibraryVerify")

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

const library = {
  slug: "lib",
  name: "Library",
  openingTimes: hours,
  website: "https://lib.example",
}

const fetchMock = vi.fn()

beforeEach(() => {
  session.value = { data: { user: { id: "u1" } }, isPending: false }
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const show = (onDone = vi.fn()) => {
  render(
    createElement(LibraryVerify, {
      library,
      initial: ["hours", "contact"],
      onDone,
      returnTo: "/europe/uk/bath/lib?suggest=verify",
    })
  )

  return onDone
}

const box = (name: string) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement

describe("LibraryVerify", () => {
  it("offers the sections the record has, ticked as asked", () => {
    show()
    expect(
      screen.getByRole("heading", { name: "Is this still right?" })
    ).toBeTruthy()
    expect(box("Opening hours").checked).toBe(true)
    expect(box("Contact details").checked).toBe(true)
    expect(screen.queryByRole("checkbox", { name: "Open or closed" })).toBe(
      null
    )
    expect(screen.queryByRole("checkbox", { name: "Address" })).toBe(null)
    expect(screen.getByText("Mon 09:00–17:00")).toBeTruthy()
    expect(screen.getByText("lib.example")).toBeTruthy()
  })

  it("asks for a source or an in-person check before sending", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByRole("alert").textContent).toBe(
      "Add the page you checked, or tick “I checked in person”."
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ties a source problem to the source field", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    const alert = screen.getByRole("alert")
    const input = screen.getByLabelText(/Where did you check/)
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(alert.id).toBeTruthy()
    expect(input.getAttribute("aria-describedby")).toBe(alert.id)

    fireEvent.change(input, { target: { value: "not a url" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByRole("alert").textContent).toBe(
      "The source must be a web address."
    )
    expect(input.getAttribute("aria-invalid")).toBe("true")
  })

  it("ties a sections problem to the sections, not the source", () => {
    render(
      createElement(LibraryVerify, {
        library,
        initial: [],
        onDone: vi.fn(),
        returnTo: "/lib",
      })
    )
    fireEvent.click(box("I checked in person"))
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe("Choose at least one section to confirm.")
    const group = screen.getByRole("group", { name: "What did you check?" })
    expect(group.getAttribute("aria-describedby")).toBe(alert.id)
    const input = screen.getByLabelText(/Where did you check/)
    expect(input.getAttribute("aria-invalid")).toBeNull()
  })

  it("sends a verify correction and thanks the reader", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: {} }, { status: 201 }))
    const onDone = show()
    fireEvent.click(box("I checked in person"))
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() =>
      expect(
        screen.getByText("Thanks. A Moderator will check it.")
      ).toBeTruthy()
    )
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/submissions")
    expect(init.method).toBe("POST")
    const body = JSON.parse(String(init.body))
    expect(body.fields).toEqual({
      kind: "verify",
      sections: ["hours", "contact"],
      libraryName: "Library",
    })
    expect(body.evidenceType).toBe("on_site_visit")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onDone).toHaveBeenCalled()
  })

  it("shows Strapi's message when it refuses", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          data: null,
          error: {
            status: 400,
            message: "Choose at least one section to confirm.",
          },
        },
        { status: 400 }
      )
    )
    show()
    fireEvent.change(screen.getByLabelText(/Where did you check/), {
      target: { value: "https://lib.example/hours" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Choose at least one section to confirm."
      )
    )
    // Strapi's message isn't about the source field.
    expect(
      screen.getByLabelText(/Where did you check/).getAttribute("aria-invalid")
    ).toBeNull()
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)
    )
    expect(body).toMatchObject({
      evidenceType: "other",
      evidenceUrl: "https://lib.example/hours",
    })
  })

  it("asks the reader to sign in when the session has ended", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    )
    show()
    fireEvent.click(box("I checked in person"))
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    const link = await screen.findByRole("link", { name: "Sign in to confirm" })
    expect(link.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/europe/uk/bath/lib?suggest=verify")}`
    )
  })

  it("asks a signed-out reader to sign in instead of sending", () => {
    session.value = { data: null, isPending: false }
    show()
    expect(screen.queryByRole("button", { name: "Send" })).toBe(null)
    expect(
      screen.getByRole("link", { name: "Sign in to confirm" })
    ).toBeTruthy()
  })
})
