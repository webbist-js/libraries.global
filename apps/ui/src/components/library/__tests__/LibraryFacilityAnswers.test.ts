// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
  },
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      createElement("a", { href }, children),
  }
})

const { LibraryFacilityAnswers } = await import("../LibraryFacilityAnswers")

const DRIVE = "drv00000000000000000001"
const fetchMock = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const rows = [
  { label: "Hearing loop", icon: "x", state: "unknown" as const },
  { label: "Wi-Fi", icon: "x", state: "unknown" as const },
]

function show(extra: Record<string, unknown> = {}) {
  const onSent = vi.fn()
  render(
    h(LibraryFacilityAnswers, {
      rows,
      librarySlug: "nailsea",
      libraryName: "Nailsea Library",
      libraryPath: "/europe/uk/somerset/nailsea",
      onSent,
      ...extra,
    })
  )
  const yes = screen
    .getByRole("group", { name: "Hearing loop" })
    .querySelector("button")!
  fireEvent.click(yes)

  return onSent
}

const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)))

describe("LibraryFacilityAnswers", () => {
  it("sends as before on the library page, with no drive", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: {} }))
    const onSent = show()
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(bodies()[0]).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "nailsea",
      editSummary: "Accessibility: Hearing loop yes",
      fields: {
        kind: "facilities",
        category: "Accessibility",
        libraryName: "Nailsea Library",
        answers: { "Hearing loop": "yes" },
      },
    })
  })

  it("tags the drive, and offers to send without it when refused", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: "This drive isn’t open." } },
          { status: 422 }
        )
      )
      .mockResolvedValueOnce(Response.json({ data: {} }))
    const onSent = show({
      driveDocumentId: DRIVE,
      libraryDocumentId: "lib00000000000000000001",
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))

    expect(await screen.findByText("This drive isn’t open.")).toBeTruthy()
    expect(onSent).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole("button", { name: "Send without the drive" })
    )
    await waitFor(() => expect(onSent).toHaveBeenCalled())

    const [tagged, plain] = bodies()
    expect(tagged).toMatchObject({
      driveDocumentId: DRIVE,
      targetDocumentId: "lib00000000000000000001",
    })
    expect(plain).not.toHaveProperty("driveDocumentId")
    expect(plain.fields).toEqual(tagged.fields)
  })

  it("never offers to drop a drive it wasn't given", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { message: "Nope." } }, { status: 422 })
    )
    show()
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    expect(await screen.findByText("Nope.")).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Send without the drive" })
    ).toBeNull()
  })
})
