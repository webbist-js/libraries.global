// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireEvent, render, screen, waitFor } from "@/test/render"

// Form behavior does not depend on Iconify's remote icon requests.
vi.mock("@iconify/react", () => ({ Icon: () => null }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ConnectFeedForm } from "../ConnectFeedForm"

const LIBS = [
  {
    documentId: "lib00000000000000000001",
    name: "Central Library",
    slug: "central-library",
  },
]

const TWO_LIBS = [
  ...LIBS,
  {
    documentId: "lib00000000000000000002",
    name: "Branch Library",
    slug: "branch-library",
  },
]

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.endsWith("/test")
          ? { data: { result: "auth_failed" } }
          : { data: { result: "ok", submissionDocumentId: "s1" } },
        { status: 200 }
      )
    )
  )
})

describe("ConnectFeedForm", () => {
  it("preselects a single library and shows the provider's fields", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    expect(screen.getByText("Central Library")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: /Calendar feed/ }))
    expect(
      screen.getByLabelText(/Calendar address/, { selector: "input" })
    ).toBeTruthy()
  })

  it("marks secret inputs as passwords that browsers won't autofill", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    const input = screen.getByLabelText(/API key/, {
      selector: "input",
    }) as HTMLInputElement
    expect(input.type).toBe("password")
    expect(input.autocomplete).toBe("new-password")
    expect(input.dataset["1pIgnore"]).not.toBeNull()
    expect(input.dataset.lpignore).toBe("true")
  })

  it("ignores an initialLibrary the user hasn't claimed", () => {
    render(
      <ConnectFeedForm
        libraries={TWO_LIBS}
        initialLibrary="lib00000000000000000099"
        oauth={{ eventbrite: false }}
      />
    )
    expect(
      screen.getByRole("combobox", { name: /Choose a library/ }).textContent
    ).toBe(TWO_LIBS[0]!.name)
  })

  it("keeps the selected library inside one encoded OAuth query parameter", () => {
    const documentId =
      'branch&redirect=https://example.invalid/#<svg onload="alert(1)">'
    render(
      <ConnectFeedForm
        libraries={[
          ...LIBS,
          { documentId, name: "Unusual library", slug: "unusual" },
        ]}
        oauth={{ eventbrite: true }}
      />
    )
    fireEvent.keyDown(screen.getByLabelText(/Choose a library/), {
      key: "ArrowDown",
    })
    fireEvent.click(screen.getByRole("option", { name: "Unusual library" }))
    fireEvent.click(screen.getByRole("radio", { name: /Eventbrite/ }))
    const link = screen.getByRole("link", {
      name: "Connect with Eventbrite",
    }) as HTMLAnchorElement
    const url = new URL(link.href)
    expect(url.pathname).toBe("/api/contribute/event-feeds/eventbrite/start")
    expect([...url.searchParams]).toEqual([["library", documentId]])
    expect(url.hash).toBe("")
    expect(link.querySelector("svg")).toBeNull()
  })

  it("resets the test result when the chosen library changes", async () => {
    render(
      <ConnectFeedForm libraries={TWO_LIBS} oauth={{ eventbrite: false }} />
    )
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    fireEvent.change(screen.getByLabelText(/API key/, { selector: "input" }), {
      target: { value: "ts_live_ABCDEFGHIJ" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(screen.getByText(/refused these details/)).toBeTruthy()
    )

    fireEvent.keyDown(screen.getByLabelText(/Choose a library/), {
      key: "ArrowDown",
    })
    fireEvent.click(screen.getByRole("option", { name: "Branch Library" }))

    expect(screen.queryByText(/refused these details/)).toBeNull()
    expect(
      (
        screen.getByRole("button", {
          name: "Connect",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("shows the test result in plain words and blocks sending on a fixable failure", async () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    fireEvent.change(screen.getByLabelText(/API key/, { selector: "input" }), {
      target: { value: "ts_live_ABCDEFGHIJ" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(screen.getByText(/refused these details/)).toBeTruthy()
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Connect",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
