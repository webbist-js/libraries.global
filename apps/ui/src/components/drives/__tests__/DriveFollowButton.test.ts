// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })

const session = vi.hoisted(() => ({
  value: { data: null as unknown, isPending: false },
}))

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("span", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session.value },
}))
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

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  session.value = { data: { user: { id: "u1" } }, isPending: false }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { DriveFollowButton } = await import("../DriveFollowButton")

const DRIVE_ID = "k3v9qz2m8x7w6c5b4n1p0r9t"

const renderButton = () =>
  render(
    createElement(DriveFollowButton, {
      driveDocumentId: DRIVE_ID,
      driveSlug: "ohio-hours",
      driveTitle: "Ohio hours",
    })
  )

/** A fetch that answers the status read, then each POST in turn. */
function answers(status: boolean, ...posts: Response[]) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? (posts.shift() ?? Response.json({ following: false }))
      : Response.json({ following: status })
  )
}

describe("DriveFollowButton", () => {
  it("links a signed-out visitor to sign in, back to the drive", () => {
    session.value = { data: null, isPending: false }
    renderButton()

    const link = screen.getByRole("link", { name: "Follow drive" })
    expect(link.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community/drives/ohio-hours")}`
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("follows at once, then keeps what the server says", async () => {
    answers(false, Response.json({ following: true }))
    renderButton()

    const button = await screen.findByRole("button", { name: "Follow drive" })
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false))
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/profile/me/follow?driveDocumentId=${DRIVE_ID}`
    )

    await act(async () => {
      fireEvent.click(button)
    })

    const following = screen.getByRole("button", { name: "Following" })
    expect(following.getAttribute("aria-pressed")).toBe("true")
    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("/api/profile/me/follow")
    expect(JSON.parse(init.body as string)).toEqual({
      driveDocumentId: DRIVE_ID,
      action: "follow",
    })
  })

  it("unfollows a drive the user follows", async () => {
    answers(true, Response.json({ following: false }))
    renderButton()

    const button = await screen.findByRole("button", { name: "Following" })
    await act(async () => {
      fireEvent.click(button)
    })

    expect(
      screen
        .getByRole("button", { name: "Follow drive" })
        .getAttribute("aria-pressed")
    ).toBe("false")
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toEqual({
      driveDocumentId: DRIVE_ID,
      action: "unfollow",
    })
  })

  it("rolls back and says so when the save fails", async () => {
    answers(false, new Response("nope", { status: 500 }))
    renderButton()

    const button = await screen.findByRole("button", { name: "Follow drive" })
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false))
    await act(async () => {
      fireEvent.click(button)
    })

    expect(
      screen
        .getByRole("button", { name: "Follow drive" })
        .getAttribute("aria-pressed")
    ).toBe("false")
    expect(screen.getByRole("status").textContent).toBe(
      "Your follow preference could not be saved. Please try again."
    )
  })
})

it.each(["unavailable", "network", "invalid"])(
  "keeps an unknown follow status recoverable after a %s lookup",
  async (failure) => {
    fetchMock.mockImplementationOnce(() =>
      failure === "network"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(
            failure === "invalid"
              ? Response.json({})
              : new Response("", { status: 503 })
          )
    )
    fetchMock.mockResolvedValue(Response.json({ following: true }))
    renderButton()
    const retry = await screen.findByRole("button", { name: "Try again" })
    expect(retry.getAttribute("aria-pressed")).toBeNull()
    expect(screen.getByRole("status").textContent).toContain(
      "Follow status could not be loaded"
    )
    fireEvent.click(retry)
    await screen.findByRole("button", { name: "Following" })
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")
    ).toBe(true)
  }
)
it("ignores a delayed lookup after changing accounts", async () => {
  let resolve!: (response: Response) => void
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    .mockResolvedValue(Response.json({ following: true }))
  const view = renderButton()
  session.value = { data: { user: { id: "u2" } }, isPending: false }
  view.rerender(
    createElement(DriveFollowButton, {
      driveDocumentId: DRIVE_ID,
      driveSlug: "ohio-hours",
      driveTitle: "Ohio hours",
    })
  )
  await screen.findByRole("button", { name: "Following" })
  await act(async () => {
    resolve(Response.json({ following: false }))
  })
  expect(
    screen
      .getByRole("button", { name: "Following" })
      .getAttribute("aria-pressed")
  ).toBe("true")
})
