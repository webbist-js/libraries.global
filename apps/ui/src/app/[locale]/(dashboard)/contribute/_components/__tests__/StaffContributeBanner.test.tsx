// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { StaffContributeBanner } from "../StaffContributeBanner"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const libraries = [
  {
    id: "nailsea",
    slug: "nailsea-library",
    name: "Nailsea Library",
    libraryType: "Public",
  },
  {
    id: "mobile",
    slug: "somerset-mobile-library",
    name: "Somerset Mobile Library",
    libraryType: "Mobile",
  },
]
const clients: QueryClient[] = []
const initialSummary = { suggestions: 2, noticesActive: 1, completeness: 88 }

function renderBanner(initialMetrics = initialSummary) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)

  return render(
    <QueryClientProvider client={client}>
      <StaffContributeBanner
        libraries={libraries}
        userId="staff-user"
        initialMetrics={initialMetrics}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.unstubAllGlobals()
})

describe("StaffContributeBanner", () => {
  it("uses the initial summary and sends all four actions to the selected library", () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    renderBanner()

    expect(
      screen.getByRole("heading", { name: "Look after Nailsea Library." })
    ).toBeTruthy()
    expect(screen.getByText("88%")).toBeTruthy()
    expect(screen.getByText("notice live")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Review suggestions/ })
        .getAttribute("href")
    ).toBe("/staff/nailsea-library#suggestions")
    expect(
      screen.getByRole("link", { name: /Edit the record/ }).getAttribute("href")
    ).toBe("/staff/nailsea-library/edit")
    expect(
      screen.getByRole("link", { name: /Post a notice/ }).getAttribute("href")
    ).toBe("/staff/nailsea-library/notices#post-notice")
    expect(
      screen
        .getByRole("link", { name: /Open the Staff area/ })
        .getAttribute("href")
    ).toBe("/staff/nailsea-library")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("switches actions immediately, clears the previous library's metrics and loads the new summary", async () => {
    let complete!: (value: unknown) => void
    const fetcher = vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    vi.stubGlobal("fetch", fetcher)
    renderBanner()

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Library" }), {
      key: "ArrowDown",
    })
    fireEvent.click(
      screen.getByRole("option", { name: "Somerset Mobile Library" })
    )
    expect(
      screen.getByRole("heading", {
        name: "Look after Somerset Mobile Library.",
      })
    ).toBeTruthy()
    expect(screen.queryByText("88%")).toBeNull()
    expect(
      screen.getByRole("link", { name: /Edit the record/ }).getAttribute("href")
    ).toBe("/staff/somerset-mobile-library/edit")
    expect(
      screen.getByText("Timetable, contacts, services and photos.")
    ).toBeTruthy()
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/staff/mobile/overview",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )

    complete({
      ok: true,
      json: async () => ({
        library: { completeness: 100 },
        counts: { suggestions: 0, noticesActive: 0 },
      }),
    })
    await waitFor(() => expect(screen.getByText("100%")).toBeTruthy())
    expect(screen.getByText("Nothing waiting for review.")).toBeTruthy()
    expect(screen.getByText("notices live")).toBeTruthy()
    expect(screen.queryByLabelText("2 suggestions to review")).toBeNull()
  })

  it("keeps actions available when a new library's summary fails, with a retry", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal("fetch", fetcher)
    renderBanner()
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Library" }), {
      key: "ArrowDown",
    })
    fireEvent.click(
      screen.getByRole("option", { name: "Somerset Mobile Library" })
    )

    await waitFor(() =>
      expect(
        screen.getByText("The library summary is unavailable.")
      ).toBeTruthy()
    )
    expect(screen.queryByText("88%")).toBeNull()
    expect(screen.getAllByText("—")).toHaveLength(3)
    expect(
      screen
        .getByRole("link", { name: /Review suggestions/ })
        .getAttribute("href")
    ).toBe("/staff/somerset-mobile-library#suggestions")

    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({
        library: { completeness: 25 },
        counts: { suggestions: 1, noticesActive: 1 },
      }),
    })
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByText("25%")).toBeTruthy())
    expect(screen.getByText("suggestion to review")).toBeTruthy()
  })
})
