// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { API_TERMS_VERSION } from "@/lib/team-api/config"
import type { ApiDashboard } from "@/lib/team-api/types"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
      createElement("a", { href }, children),
    useRouter: () => ({ push: vi.fn() }),
  }
})
import { TeamApiDashboard } from "../TeamApiDashboard"

const initial: ApiDashboard = {
  teamId: "team00000000000000000001",
  teamName: "Library service",
  organiser: true,
  teamActive: true,
  membership: null,
  active: true,
  purchasing: true,
  price: { unitAmount: 1500, currency: "gbp" },
  limits: {
    requests: 100_000,
    bytes: 10 * 1024 ** 3,
    perMinute: 60,
    concurrency: 5,
    keys: 5,
    responseBytes: 262144,
  },
  usage: { requests: 0, bytes: 0, resetsAt: "2026-11-01T00:00:00Z" },
  keys: [],
  days: [],
  endpoints: [],
  warnings: [],
  pendingPayment: false,
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("Team API staff dashboard", () => {
  it("lets members inspect usage without key or billing mutations", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, organiser: false }}
        teams={[]}
        confirming={false}
      />
    )
    expect(screen.getByRole("heading", { name: "This month" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Subscribe to API access" })
    ).toBeNull()
  })
  it("requires explicit consent before checkout", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false }}
        teams={[]}
        confirming={false}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Add API access" }))
    const dialog = screen.getByRole("dialog", { name: "Add API access" })
    expect(within(dialog).getByText("£15.00")).toBeTruthy()
    expect(within(dialog).getByText("100,000")).toBeTruthy()
    expect(within(dialog).getByText("10 GiB")).toBeTruthy()
    const button = within(dialog).getByRole("button", {
      name: "Subscribe to API access",
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(button.disabled).toBe(false)
  })
  it("submits the terms version accepted by API checkout", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: "fixture_stop" }, { status: 400 })
      )
    vi.stubGlobal("fetch", fetcher)
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false }}
        teams={[]}
        confirming={false}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Add API access" }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(
      screen.getByRole("button", { name: "Subscribe to API access" })
    )
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      action: "checkout",
      locale: "en",
      termsVersion: API_TERMS_VERSION,
    })
    const dialog = screen.getByRole("dialog", { name: "Add API access" })
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "API access is temporarily unavailable"
      )
    )
    expect(within(dialog).getByRole("checkbox").getAttribute("type")).toBe(
      "checkbox"
    )
  })

  it("resets consent when the modal is dismissed without creating a checkout", () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetcher)
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false }}
        teams={[]}
        confirming={false}
      />
    )
    const trigger = screen.getByRole("button", { name: "Add API access" })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(trigger)
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Subscribe to API access",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("does not offer a second checkout while payment is being confirmed", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false, pendingPayment: true }}
        teams={[]}
        confirming
      />
    )
    expect(screen.getByText("Confirming payment")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Add API access" })).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
  it("shows a created secret once and blocks another creation until it is saved", async () => {
    const secret = `lg_api_${"a".repeat(43)}`
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "key", secret }))
      .mockResolvedValueOnce(Response.json(initial))
    vi.stubGlobal("fetch", fetcher)
    render(<TeamApiDashboard initial={initial} teams={[]} confirming={false} />)
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Create key" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Council website" },
    })
    fireEvent.submit(
      screen.getByRole("button", { name: "Create key" }).closest("form")!
    )
    await waitFor(() => expect(screen.getByText(secret)).toBeTruthy())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByText(secret).closest('[role="status"]')
      )
    )
    expect(
      (screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "I have saved it" }))
    expect(screen.queryByText(secret)).toBeNull()
  })

  it("creates only the selected API access and optional expiry from the key dialog", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: "fixture_stop" }, { status: 400 })
      )
    vi.stubGlobal("fetch", fetcher)
    render(<TeamApiDashboard initial={initial} teams={[]} confirming={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Create key" }))
    const dialog = screen.getByRole("dialog", { name: "Create an API key" })
    const create = within(dialog).getByRole("button", {
      name: "Create key",
    }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: " Council website " },
    })
    fireEvent.change(within(dialog).getByLabelText("Expiry (optional)"), {
      target: { value: "2027-01-31" },
    })
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library search/ })
    )
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library records/ })
    )
    expect(create.disabled).toBe(true)
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library records/ })
    )
    fireEvent.submit(create.closest("form")!)
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      action: "create",
      name: "Council website",
      scopes: ["libraries:read"],
      expiresAt: "2027-01-31T23:59:59.000Z",
    })
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "API access is temporarily unavailable"
      )
    )
  })

  it("can dismiss key creation without issuing a key", () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetcher)
    render(<TeamApiDashboard initial={initial} teams={[]} confirming={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Create key" }))
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("sends only the key id and action after regeneration confirmation", async () => {
    const key = {
      id: "d29c6f94-078d-4b54-99a3-60ef7041eaaa",
      name: "Council site",
      prefix: "lg_api_fixture",
      scopes: ["libraries:read" as const],
      createdAt: "2026-10-13T00:00:00Z",
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      requests: 0,
      bytes: 0,
    }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ id: key.id, secret: "replacement" })
      )
      .mockResolvedValueOnce(Response.json(initial))
    vi.stubGlobal("fetch", fetcher)
    render(
      <TeamApiDashboard
        initial={{ ...initial, keys: [key] }}
        teams={[]}
        confirming={false}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      action: "rotate",
      keyId: key.id,
    })
  })
  it("shows daily requests, bytes and errors in the accessible table", () => {
    render(
      <TeamApiDashboard
        initial={{
          ...initial,
          usage: { ...initial.usage, requests: 29_527, bytes: 124 * 1024 ** 2 },
          days: [
            { day: "2026-10-20", requests: 500, bytes: 1024 ** 2, errors: 3 },
          ],
        }}
        teams={[]}
        confirming={false}
      />
    )
    expect(screen.getByText("70,473 left this month")).toBeTruthy()
    expect(
      screen.getByRole("heading", {
        name: "Requests per day · since Oct 20, 2026",
      })
    ).toBeTruthy()
    const toggle = screen.getByRole("button", { name: "Show daily table" })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(toggle)
    const table = screen.getByRole("table", { name: "Daily API usage" })
    expect(table.textContent).toContain("2026-10-20")
    expect(table.textContent).toContain("500")
    expect(table.textContent).toContain("1.0 MiB")
    expect(table.textContent).toContain("Errors")
    expect(
      screen
        .getByRole("button", { name: "Show chart" })
        .getAttribute("aria-expanded")
    ).toBe("true")
  })

  it("counts only active keys toward the limit and prevents creating beyond it", () => {
    const key = {
      id: "key-1",
      name: "Council site",
      prefix: "lg_api_fixture",
      scopes: ["libraries:read" as const],
      createdAt: "2020-01-01T00:00:00Z",
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      requests: 0,
      bytes: 0,
    }
    render(
      <TeamApiDashboard
        initial={{
          ...initial,
          limits: { ...initial.limits, keys: 1 },
          keys: [
            key,
            {
              ...key,
              id: "old-key",
              name: "Old site",
              expiresAt: "2020-02-01T00:00:00Z",
            },
          ],
        }}
        teams={[]}
        confirming={false}
      />
    )
    expect(screen.getByText("1 of 1 active")).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    const regenerate = screen.getAllByRole("button", {
      name: "Regenerate",
    }) as HTMLButtonElement[]
    expect(regenerate[0]!.disabled).toBe(false)
    expect(regenerate[1]!.disabled).toBe(true)
  })
})
