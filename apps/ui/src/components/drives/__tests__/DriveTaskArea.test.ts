// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Drive } from "@/lib/drives/types"

Object.assign(globalThis, { React })

const session = vi.hoisted(() => ({
  value: { data: { user: { id: "u1" } }, isPending: false } as {
    data: { user: Record<string, unknown> } | null
    isPending: boolean
  },
}))

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session.value },
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => createElement("a", { href, ...rest }, children),
  }
})
vi.mock("@/components/contribute/CorrectionEditor", async () => {
  const { createElement } = await import("react")

  return {
    CorrectionEditor: ({
      edit,
      onChange,
    }: {
      edit: Record<string, unknown>
      onChange: (e: Record<string, unknown>) => void
    }) =>
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onChange({
              ...edit,
              openingTimes: {
                version: 1,
                days: [
                  {
                    day: "monday",
                    enabled: true,
                    timeframes: [
                      {
                        id: "a",
                        startTime: "09:00",
                        endTime: "17:00",
                        staffing: "staffed",
                      },
                    ],
                  },
                ],
              },
            }),
        },
        "Set Monday"
      ),
  }
})

const { DriveTaskArea } = await import("../DriveTaskArea")

const DRIVE: Drive = {
  documentId: "drv00000000000000000001",
  title: "Ohio hours",
  slug: "ohio-hours",
  summary: "Add a week of hours.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "branch",
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-31T00:00:00.000Z",
  goalPercent: 100,
  status: "open",
  pinned: false,
  featured: false,
  locale: "en",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  steps: [],
}

const TASKS = ["Alpha", "Beta", "Gamma"].map((name, i) => ({
  documentId: `lib0000000000000000000${i}`,
  slug: name.toLowerCase(),
  name: `${name} Library`,
  city: "Columbus",
  region_name: "Ohio",
  website: `https://${name.toLowerCase()}.example.org`,
  href: null,
  inReview: false,
}))

const fetchMock = vi.fn()

function respond(url: string, init?: RequestInit) {
  if (url.startsWith("/api/drives/ohio-hours/tasks"))
    return Promise.resolve(
      Response.json({ data: TASKS, page: 0, hasMore: false })
    )
  if (url.startsWith("/api/drives/ohio-hours/mine"))
    return Promise.resolve(
      Response.json({ data: { sent: 2, inReview: 1, accepted: 1 } })
    )
  if (url === "/api/contribute/standing")
    return Promise.resolve(
      Response.json({
        data: {
          totalPoints: 64,
          tier: {
            name: "Indexer",
            nextName: "Cartographer",
            nextThreshold: 500,
          },
        },
        pendingCount: 3,
        pendingLimit: 5,
      })
    )
  if (url.startsWith("/api/contribute/library/"))
    return Promise.resolve(
      Response.json({
        data: {
          documentId: "x",
          name: "x",
          openingTimes: null,
          accessibility: [],
          amenities: [],
          services: [],
          absentFacilities: [],
        },
      })
    )
  if (url === "/api/submissions" && init?.method === "POST")
    return Promise.resolve(Response.json({ data: { documentId: "s1" } }))

  return Promise.resolve(new Response("nope", { status: 404 }))
}

let wide = true

beforeEach(() => {
  wide = true
  session.value = { data: { user: { id: "u1" } }, isPending: false }
  fetchMock.mockReset().mockImplementation(respond)
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  )
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const row = (name: string) =>
  screen.getByRole("button", { name: `Add hours for ${name}` })

async function sendHoursFor(name: string) {
  fireEvent.click(row(name))
  fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
  fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
    target: { value: "https://example.org/hours" },
  })
  fireEvent.click(
    screen.getByRole("button", { name: "Send and get the next one" })
  )
}

describe("DriveTaskArea", () => {
  it("lists the drive's open tasks and shows Your part", async () => {
    render(h(DriveTaskArea, { drive: DRIVE }))
    expect(await screen.findByText("Alpha Library")).toBeTruthy()
    const urls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(urls).toContain("/api/drives/ohio-hours/tasks?page=0&locale=en")
    const part = await screen.findByRole("region", { name: "Your part" })
    await waitFor(() =>
      expect(within(part).getByText("3 of 5 waiting for review")).toBeTruthy()
    )
    expect(
      within(part).getByText(
        "Drive work counts toward earned Pro: 1,436 points to Archivist."
      )
    ).toBeTruthy()
  })

  it("after a send: announces it, marks the row and moves to the next library", async () => {
    render(h(DriveTaskArea, { drive: DRIVE }))
    await screen.findByText("Alpha Library")
    await sendHoursFor("Alpha Library")

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Drive updates" }).textContent
      ).toBe("Sent for review")
    )
    expect(row("Alpha Library").getAttribute("aria-disabled")).toBe("true")
    expect(within(row("Alpha Library")).getByText("In review")).toBeTruthy()
    const next = screen.getByRole("heading", { name: "Beta Library" })
    expect(document.activeElement).toBe(next)
    expect(row("Beta Library").getAttribute("aria-pressed")).toBe("true")
    // "Your part" is asked again after the send.
    const mineCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).startsWith("/api/drives/ohio-hours/mine")
    )
    expect(mineCalls.length).toBeGreaterThanOrEqual(2)
  })

  it("skips for the session and moves on", async () => {
    render(h(DriveTaskArea, { drive: DRIVE }))
    await screen.findByText("Alpha Library")
    fireEvent.click(row("Alpha Library"))
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Beta Library" })
    )
    expect(
      JSON.parse(sessionStorage.getItem(`drive.skips.${DRIVE.documentId}`)!)
    ).toEqual([TASKS[0]!.documentId])
  })

  it("opens the panel in a drawer below lg", async () => {
    wide = false
    render(h(DriveTaskArea, { drive: DRIVE }))
    await screen.findByText("Alpha Library")
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(row("Alpha Library"))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Alpha Library" })).toBe(
      document.activeElement
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("asks a signed-out reader to sign in, and leaves out Your part", async () => {
    session.value = { data: null, isPending: false }
    render(h(DriveTaskArea, { drive: DRIVE }))
    await screen.findByText("Alpha Library")
    fireEvent.click(row("Alpha Library"))
    expect(screen.getByRole("link", { name: "Sign in to help" })).toBeTruthy()
    expect(screen.queryByRole("region", { name: "Your part" })).toBeNull()
    const urls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(urls.some((u) => u.includes("/mine"))).toBe(false)
    expect(urls).not.toContain("/api/contribute/standing")
  })
})
