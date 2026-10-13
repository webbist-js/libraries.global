// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DriveTask } from "@/lib/drives/types"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })

const MONDAY = vi.hoisted(() => ({
  version: 1,
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [
        { id: "a", startTime: "09:00", endTime: "17:00", staffing: "staffed" },
      ],
    },
  ],
}))

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
  },
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
// The real editors are the Index editor's own fields; these stand-ins make
// the one change each category's editor would.
vi.mock("@/components/contribute/CorrectionEditor", async () => {
  const { createElement } = await import("react")
  const CHANGE: Record<string, [string, Record<string, unknown>]> = {
    "Opening hours": ["Set Monday", { openingTimes: MONDAY }],
    "Website or catalogue": ["Set phone", { phone: "614-807-2626" }],
    "Open or closed": [
      "Mark closed",
      { operationalStatus: "permanently_closed" },
    ],
    "Address or location": ["Set address", { streetAddress: "1 New St" }],
  }

  return {
    CorrectionEditor: ({
      category,
      edit,
      onChange,
    }: {
      category: string
      edit: Record<string, unknown>
      onChange: (e: Record<string, unknown>) => void
    }) => {
      const [label, change] = CHANGE[category]!

      return createElement(
        "button",
        { type: "button", onClick: () => onChange({ ...edit, ...change }) },
        label
      )
    },
  }
})
vi.mock("@/components/contribute/PhotoUpload", async () => {
  const { createElement } = await import("react")

  return {
    PhotoUpload: ({ onChange }: { onChange: (p: unknown) => void }) =>
      createElement(
        "button",
        {
          type: "button",
          onClick: () => onChange({ id: 7, url: "/uploads/front.jpg" }),
        },
        "Upload"
      ),
  }
})

const { DriveTaskPanel } = await import("../DriveTaskPanel")

const DRIVE_ID = "drv00000000000000000001"
const LIB = "lib00000000000000000001"

const task: DriveTask = {
  documentId: LIB,
  slug: "northwest",
  name: "Worthington Libraries, Northwest",
  city: "Columbus",
  region_name: "Ohio",
  website: "https://worthingtonlibraries.org",
  href: "/north-america/united-states/ohio/northwest",
  inReview: false,
}

const record = {
  documentId: LIB,
  name: task.name,
  city: "Columbus",
  streetAddress: "2280 Hard Rd",
  operationalStatus: "open",
  openingTimes: null,
  accessibility: [],
  amenities: [],
  services: [],
  absentFacilities: [],
}

const fetchMock = vi.fn()
let postResponses: Response[] = []

function respond(url: string, init?: RequestInit) {
  if (url.startsWith("/api/contribute/library/"))
    return Promise.resolve(Response.json({ data: record }))
  if (url === "/api/submissions" && init?.method === "POST")
    return Promise.resolve(
      postResponses.shift() ?? Response.json({ data: { documentId: "s1" } })
    )

  return Promise.resolve(new Response("not found", { status: 404 }))
}

beforeEach(() => {
  postResponses = []
  fetchMock.mockReset().mockImplementation(respond)
  vi.stubGlobal("fetch", fetchMock)
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const focus = (...gaps: string[]) => ({ kind: "gaps" as const, gaps }) as never

function show(props: Partial<Parameters<typeof DriveTaskPanel>[0]> = {}) {
  const onSent = vi.fn()
  const onSkip = vi.fn()
  render(
    h(DriveTaskPanel, {
      drive: {
        documentId: DRIVE_ID,
        slug: "ohio-hours",
        focus: focus("hours"),
      },
      task,
      signedIn: true,
      claimed: false,
      quota: { pendingCount: 1, pendingLimit: 5 },
      onSent,
      onSkip,
      ...props,
    })
  )

  return { onSent, onSkip }
}

const posts = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) => url === "/api/submissions" && init?.method === "POST"
    )
    .map(([, init]) => JSON.parse(String(init.body)))

const send = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Send and get the next one" })
  )

describe("DriveTaskPanel", () => {
  it("asks a signed-out reader to sign in, back to the drive", () => {
    show({ signedIn: false })
    const link = screen.getByRole("link", { name: "Sign in to help" })
    expect(link.getAttribute("href")).toBe(
      "/auth/signin?callbackUrl=%2Fcommunity%2Fdrives%2Fohio-hours"
    )
    expect(
      screen.queryByRole("button", { name: "Send and get the next one" })
    ).toBeNull()
    expect(screen.getByRole("heading", { name: task.name })).toBeTruthy()
  })

  it("links to the library's site, or searches for it", () => {
    show()
    const site = screen.getByRole("link", {
      name: /Open the library’s website/,
    })
    expect(site.getAttribute("href")).toBe("https://worthingtonlibraries.org")
    expect(site.getAttribute("target")).toBe("_blank")
    expect(site.getAttribute("rel")).toBe("noopener noreferrer")
    cleanup()

    show({ task: { ...task, website: null } })
    const search = screen.getByRole("link", { name: /Search for this library/ })
    expect(search.getAttribute("href")).toBe(
      "https://duckduckgo.com/?q=Worthington%20Libraries%2C%20Northwest%20Columbus"
    )
    expect(search.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("sends hours as a record correction tagged with the drive", async () => {
    const { onSent } = show()
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
      target: { value: "https://worthingtonlibraries.org/hours" },
    })
    send()

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(task))
    const [body] = posts()
    expect(body).toMatchObject({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "northwest",
      targetDocumentId: LIB,
      driveDocumentId: DRIVE_ID,
      evidenceType: "other",
      evidenceUrl: "https://worthingtonlibraries.org/hours",
      fields: {
        kind: "record",
        category: "Opening hours",
        libraryName: task.name,
        previous: { openingTimes: null },
      },
    })
    expect(body.fields.openingTimes.days).toHaveLength(7)
  })

  it("needs the page the hours came from", async () => {
    const { onSent } = show()
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    send()
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Add the page you found this on."
    )
    expect(
      screen
        .getByLabelText(/Where did you find this\?/)
        .getAttribute("aria-invalid")
    ).toBe("true")
    expect(posts()).toHaveLength(0)
    expect(onSent).not.toHaveBeenCalled()
  })

  it("offers to send without the drive when the drive's rules refuse it", async () => {
    postResponses = [
      Response.json(
        {
          error: {
            status: 422,
            message: "This library isn’t part of the drive.",
          },
        },
        { status: 422 }
      ),
    ]
    const { onSent } = show()
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
      target: { value: "https://worthingtonlibraries.org/hours" },
    })
    send()

    expect(
      await screen.findByText("This library isn’t part of the drive.")
    ).toBeTruthy()
    expect(onSent).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole("button", { name: "Send without the drive" })
    )

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(task))
    const [tagged, plain] = posts()
    expect(tagged.driveDocumentId).toBe(DRIVE_ID)
    expect(plain).not.toHaveProperty("driveDocumentId")
    expect(plain.fields).toEqual(tagged.fields)
    expect(plain.evidenceUrl).toBe(tagged.evidenceUrl)
  })

  it("shows other refusals as they are, with no way round the drive", async () => {
    postResponses = [
      Response.json(
        {
          error: {
            status: 429,
            message: "Too many submissions this hour. Try again later.",
          },
        },
        { status: 429 }
      ),
    ]
    show()
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
      target: { value: "https://worthingtonlibraries.org/hours" },
    })
    send()
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many submissions this hour. Try again later."
    )
    expect(
      screen.queryByRole("button", { name: "Send without the drive" })
    ).toBeNull()
  })

  it("stops at the pending limit, and says why", async () => {
    show({ quota: { pendingCount: 5, pendingLimit: 5 } })
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    const button = screen.getByRole("button", {
      name: "Send and get the next one",
    })
    expect(button.hasAttribute("disabled")).toBe(true)
    const reason = screen.getByText(
      "You have 5 changes waiting for review, the most you can have at once. Send more once some are reviewed."
    )
    expect(button.getAttribute("aria-describedby")).toBe(reason.id)
    expect(
      screen
        .getByRole("link", { name: "See my submissions" })
        .getAttribute("href")
    ).toBe("/contribute/submissions")
  })

  it("sends contact details from the links editor", async () => {
    const { onSent } = show({
      drive: {
        documentId: DRIVE_ID,
        slug: "ohio-contact",
        focus: focus("contact"),
      },
    })
    fireEvent.click(await screen.findByRole("button", { name: "Set phone" }))
    fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
      target: { value: "https://worthingtonlibraries.org/contact" },
    })
    send()
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(posts()[0]).toMatchObject({
      driveDocumentId: DRIVE_ID,
      fields: {
        kind: "record",
        category: "Website or catalogue",
        phone: "614-807-2626",
      },
    })
  })

  it("sends a photo once the licence is confirmed", async () => {
    const { onSent } = show({
      drive: {
        documentId: DRIVE_ID,
        slug: "ohio-photos",
        focus: focus("photo"),
      },
    })
    expect(screen.queryByLabelText(/Where did you find this\?/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Upload" }))
    send()
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Confirm you can share it under CC BY-SA 4.0."
    )
    fireEvent.click(screen.getByRole("checkbox", { name: /I took this photo/ }))
    send()
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(posts()[0]).toMatchObject({
      driveDocumentId: DRIVE_ID,
      targetDocumentId: LIB,
      evidenceType: "on_site_photo",
      fields: { kind: "photo", photoId: 7, licence: "CC BY-SA 4.0" },
    })
  })

  it("asks the library page's accessibility questions, tagged with the drive", async () => {
    const { onSent } = show({
      drive: {
        documentId: DRIVE_ID,
        slug: "ohio-access",
        focus: focus("accessibility"),
      },
    })
    const loop = await screen.findByRole("group", { name: "Hearing loop" })
    fireEvent.click(loop.querySelector("button")!)
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(task))
    expect(posts()[0]).toMatchObject({
      driveDocumentId: DRIVE_ID,
      targetDocumentId: LIB,
      fields: { kind: "facilities", answers: { "Hearing loop": "yes" } },
    })
  })

  it("“closed or moved” sends status and address as one record correction", async () => {
    const { onSent } = show()
    await screen.findByRole("button", { name: "Set Monday" })
    fireEvent.click(
      screen.getByRole("button", { name: "This library has closed or moved" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Mark closed" }))
    fireEvent.click(screen.getByRole("button", { name: "Set address" }))
    send()
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(posts()[0]).toMatchObject({
      driveDocumentId: DRIVE_ID,
      fields: {
        kind: "record",
        category: "Open or closed",
        operationalStatus: "permanently_closed",
        streetAddress: "1 New St",
      },
    })
  })

  it("skips without sending", async () => {
    const { onSkip } = show()
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(onSkip).toHaveBeenCalledWith(task)
    expect(posts()).toHaveLength(0)
  })

  it("sends a claimant's hours as a library edit", async () => {
    const { onSent } = show({ claimed: true })
    fireEvent.click(await screen.findByRole("button", { name: "Set Monday" }))
    fireEvent.change(screen.getByLabelText(/Where did you find this\?/), {
      target: { value: "https://worthingtonlibraries.org/hours" },
    })
    send()
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(posts()[0]).toMatchObject({
      submissionType: "library_edit",
      targetDocumentId: LIB,
      driveDocumentId: DRIVE_ID,
    })
  })
})
