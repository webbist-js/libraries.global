// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { contributionAccountScope } from "@/lib/contribution-account-scope"
import type { Drive } from "@/lib/drives/types"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

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
  if (url.startsWith("/api/drives/ohio-hours/holds"))
    return Promise.resolve(
      Response.json({ data: { expiresAt: "2026-10-12T00:00:00Z" } })
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
  screen.getByRole("button", {
    name: (label) => label.startsWith(name),
    description: (label) => label.startsWith(`Add hours for ${name}`),
    hidden: true,
  })

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
        "Drive work counts toward earned Pro: 4,936 points to 5,000. Keep contributing at least once every 30 days to retain it."
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
    const next = await screen.findByRole("heading", { name: "Beta Library" })
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
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }))
    const next = await screen.findByRole("heading", { name: "Beta Library" })
    await waitFor(() => expect(document.activeElement).toBe(next))
    expect(
      JSON.parse(
        sessionStorage.getItem(
          `drive.skips.${DRIVE.documentId}:${contributionAccountScope(session.value.data?.user)}`
        )!
      )
    ).toEqual([TASKS[0]!.documentId])
  })

  it("opens the panel in a drawer below lg", async () => {
    wide = false
    render(h(DriveTaskArea, { drive: DRIVE }))
    await screen.findByText("Alpha Library")
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(row("Alpha Library"))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Alpha Library" })).toBe(
      document.activeElement
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(row("Alpha Library").getAttribute("aria-pressed")).toBe("false")
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

it("keeps the selected place in task searches", async () => {
  render(
    h(DriveTaskArea, {
      drive: DRIVE,
      initialPlace: { country: "united-states", region: "ohio" },
    })
  )
  await screen.findByText("Alpha Library")
  const urls = fetchMock.mock.calls.map(([url]) => String(url))
  expect(urls).toContain(
    "/api/drives/ohio-hours/tasks?country=united-states&region=ohio&page=0&locale=en"
  )
})

it("preserves the selected place through sign-in", async () => {
  session.value = { data: null, isPending: false }
  render(
    h(DriveTaskArea, {
      drive: DRIVE,
      initialPlace: { country: "united-states", region: "ohio" },
    })
  )
  await screen.findByText("Alpha Library")
  fireEvent.click(row("Alpha Library"))
  const link = await screen.findByRole("link", { name: "Sign in to help" })
  const href = new URL(link.getAttribute("href")!, "http://localhost")
  expect(href.searchParams.get("callbackUrl")).toBe(
    "/community/drives/ohio-hours?country=united-states&region=ohio"
  )
})

it("replaces paged tasks and resets pagination when the search changes", async () => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/drives/ohio-hours/tasks")) {
      const page = Number(
        new URL(url, "http://localhost").searchParams.get("page")
      )

      return Promise.resolve(
        Response.json({
          data:
            page === 1
              ? [{ ...TASKS[0], name: "Delta Library", documentId: "delta" }]
              : TASKS,
          page,
          pageSize: 8,
          total: 9,
          hasMore: page === 0,
        })
      )
    }

    return respond(url, init)
  })
  render(h(DriveTaskArea, { drive: DRIVE }))
  await screen.findByText("Alpha Library")
  fireEvent.click(screen.getByRole("button", { name: "Page 2" }))
  await screen.findByText("Delta Library")
  expect(screen.queryByText("Alpha Library")).toBeNull()
  expect(
    screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")
  ).toBe("page")
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Columbus" },
  })
  await screen.findByText("Alpha Library")
  expect(
    screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")
  ).toBe("page")
  expect(
    fetchMock.mock.calls.some(([url]) =>
      String(url).includes("q=Columbus&page=0")
    )
  ).toBe(true)
})

it("clears personal counts immediately when the signed-in account changes", async () => {
  let resolveMine: ((value: Response) => void) | undefined
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes("/mine") && session.value.data?.user.id === "u2")
      return new Promise<Response>((resolve) => {
        resolveMine = resolve
      })

    return respond(url, init)
  })
  const result = render(h(DriveTaskArea, { drive: DRIVE }))
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Your part" }).textContent
    ).toContain("2Sent")
  )
  session.value = { data: { user: { id: "u2" } }, isPending: false }
  result.rerender(h(DriveTaskArea, { drive: DRIVE }))
  const part = screen.getByRole("region", { name: "Your part" })
  expect(part.textContent).toContain("Loading your part…")
  expect(part.textContent).not.toContain("2Sent")
  await waitFor(() => expect(resolveMine).toBeTruthy())
  resolveMine!(Response.json({ data: { sent: 0, inReview: 0, accepted: 0 } }))
  await within(part).findByText("Nothing sent for this drive yet.")
})
