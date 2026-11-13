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
  overageAvailable: true,
  price: { unitAmount: 10_000, currency: "gbp" },
  limits: {
    requests: 10_000,
    bytes: 262_144_000,
    analysisCredits: 100,
    perMinute: 30,
    concurrency: 2,
    keys: null,
    responseBytes: 131_072,
    pageSize: 50,
  },
  rates: { requestPence: 1, mibPence: 10, creditPence: 50 },
  overage: { enabled: false, capPence: 0, revision: 0, updatedAt: null },
  usage: {
    requests: 0,
    bytes: 0,
    credits: 0,
    periodStart: "2026-11-03T09:30:00.000Z",
    resetsAt: "2026-12-03T09:30:00.000Z",
  },
  accrued: { requestsPence: 0, bytesPence: 0, creditsPence: 0, totalPence: 0 },
  projectedInvoicePence: 10000,
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
describe("API account dashboard", () => {
  it("introduces the API before purchase without empty usage charts or credential controls", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false }}
        confirming={false}
      />
    )
    expect(
      screen.getByRole("heading", { name: "Your API subscription" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("heading", { name: "This billing period" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
    expect(
      screen.getByRole("heading", { name: "More ways to use library data" })
    ).toBeTruthy()
    expect(screen.getByText("Coming soon")).toBeTruthy()
  })
  it("lets members inspect usage without key or billing mutations", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, organiser: false }}
        confirming={false}
      />
    )
    expect(
      screen.getByRole("heading", { name: "This billing period" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Subscribe to API access" })
    ).toBeNull()
  })
  it("requires explicit consent before checkout", () => {
    render(
      <TeamApiDashboard
        initial={{ ...initial, active: false }}
        confirming={false}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Add API access" }))
    const dialog = screen.getByRole("dialog", { name: "Add API access" })
    expect(within(dialog).getByText("£100.00")).toBeTruthy()
    expect(within(dialog).getByText(/tax included/)).toBeTruthy()
    expect(within(dialog).getByText("10,000")).toBeTruthy()
    expect(within(dialog).getByText("250.0 MiB")).toBeTruthy()
    expect(within(dialog).getByText("100")).toBeTruthy()
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
    render(<TeamApiDashboard initial={initial} confirming={false} />)
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Create key" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Council website" },
    })
    fireEvent.submit(
      (screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement)
        .form!
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
    render(<TeamApiDashboard initial={initial} confirming={false} />)
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
    // New keys default to the read scopes only.
    expect(
      (
        within(dialog).getByRole("checkbox", {
          name: /Run analysis/,
        }) as HTMLInputElement
      ).checked
    ).toBe(false)
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library search/ })
    )
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library records/ })
    )
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Read services/ })
    )
    expect(create.disabled).toBe(true)
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Library records/ })
    )
    fireEvent.submit(create.form!)
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
    render(<TeamApiDashboard initial={initial} confirming={false} />)
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
          usage: { ...initial.usage, requests: 2527, bytes: 124 * 1024 ** 2 },
          days: [
            { day: "2026-10-20", requests: 500, bytes: 1024 ** 2, errors: 3 },
          ],
        }}
        confirming={false}
      />
    )
    expect(screen.getByText("7,473 left this period")).toBeTruthy()
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

  it("counts active keys and allows more credentials without enlarging the Team pool", () => {
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
        confirming={false}
      />
    )
    expect(screen.getByText("1 active · unlimited keys")).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
    const regenerate = screen.getAllByRole("button", {
      name: "Regenerate",
    }) as HTMLButtonElement[]
    expect(regenerate[0]!.disabled).toBe(false)
    expect(regenerate[1]!.disabled).toBe(true)
  })
})

it("opens the guided API review with fresh consent and does not create a payment automatically", () => {
  render(
    <TeamApiDashboard
      initial={{ ...initial, active: false }}
      confirming={false}
      setupRequested
    />
  )
  const dialog = within(screen.getByRole("dialog"))
  expect(
    (
      dialog.getByRole("button", {
        name: "Subscribe to API access",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  expect((dialog.getByRole("checkbox") as HTMLInputElement).checked).toBe(false)
})

it("does not open API checkout for an inactive Team even with the setup URL hint", () => {
  render(
    <TeamApiDashboard
      initial={{ ...initial, active: false, teamActive: false }}
      confirming={false}
      setupRequested
    />
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(
    screen.queryByRole("button", { name: "Subscribe to API access" })
  ).toBeNull()
})

it("keeps the API overview free of key tooling and usage tables", () => {
  render(
    <TeamApiDashboard initial={initial} confirming={false} section="overview" />
  )
  expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
  // The overview shows a compact summary that links to the usage view,
  // never the usage panel's meters.
  expect(
    screen.getByRole("region", { name: "Current billing period" })
  ).toBeTruthy()
  expect(
    screen.getByRole("link", { name: /View usage/ }).getAttribute("href")
  ).toBe("/developers/usage")
  expect(screen.queryAllByRole("progressbar")).toHaveLength(0)
  expect(document.getElementById("api-usage")).toBeNull()
  expect(screen.queryByRole("heading", { name: "Using the API" })).toBeNull()
})

it("keeps key creation on its own page and preserves Organiser permissions", () => {
  const view = render(
    <TeamApiDashboard initial={initial} confirming={false} section="keys" />
  )
  expect(screen.getByRole("button", { name: "Create key" })).toBeTruthy()
  expect(
    screen.queryByRole("heading", { name: "This billing period" })
  ).toBeNull()
  view.rerender(
    <TeamApiDashboard
      key="member"
      initial={{ ...initial, organiser: false }}
      confirming={false}
      section="keys"
    />
  )
  expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
})

it("requires confirmation before a key may spend credits or submit proposals", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ error: "fixture_stop" }, { status: 400 })
    )
  vi.stubGlobal("fetch", fetcher)
  render(
    <TeamApiDashboard initial={initial} confirming={false} section="keys" />
  )
  fireEvent.click(screen.getByRole("button", { name: "Create key" }))
  const dialog = within(
    screen.getByRole("dialog", { name: "Create an API key" })
  )
  fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), {
    target: { value: "Analysis worker" },
  })
  fireEvent.click(dialog.getByRole("checkbox", { name: /Run analysis/ }))
  const create = dialog.getByRole("button", {
    name: "Create key",
  }) as HTMLButtonElement
  expect(create.disabled).toBe(true)
  fireEvent.click(dialog.getByRole("checkbox", { name: /I confirm this key/ }))
  expect(create.disabled).toBe(false)
  fireEvent.submit(create.form!)
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({
    action: "create",
    confirmScopes: true,
    scopes: ["search:read", "libraries:read", "services:read", "analysis:run"],
  })
})

describe("overage and period usage", () => {
  it("shows three allowances, the paid-period reset and deduplicated alerts", () => {
    render(
      <TeamApiDashboard
        initial={{
          ...initial,
          usage: { ...initial.usage, requests: 8000, credits: 50 },
          warnings: [
            { dimension: "requests", threshold: 50 },
            { dimension: "requests", threshold: 80 },
            { dimension: "credits", threshold: 50 },
          ],
        }}
        confirming={false}
        section="usage"
      />
    )
    expect(
      screen.getByRole("heading", { name: "Analysis credits" })
    ).toBeTruthy()
    expect(screen.getByText(/Resets Dec 3, 2026/)).toBeTruthy()
    const alerts = screen
      .getByText("Usage alerts this period")
      .closest("[role=status]")!
    expect(alerts.textContent).toContain("80% of included successful requests")
    expect(alerts.textContent).not.toContain(
      "50% of included successful requests"
    )
    expect(alerts.textContent).toContain("50% of included analysis credits")
  })
  it("preselects a £100 cap but never enables overage without an affirmative opt-in", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ enabled: true, capPence: 10000 }))
      .mockResolvedValueOnce(Response.json(initial))
    vi.stubGlobal("fetch", fetcher)
    render(
      <TeamApiDashboard initial={initial} confirming={false} section="usage" />
    )
    expect(screen.getByText("Overage off")).toBeTruthy()
    const turnOn = screen.getByRole("button", {
      name: "Turn on overage",
    }) as HTMLButtonElement
    expect(turnOn.disabled).toBe(true)
    expect(screen.getByText(/up to £100.00 a month before tax/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I agree to pay for usage/ })
    )
    fireEvent.click(turnOn)
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      action: "overage",
      enabled: true,
      capPence: 10000,
      termsVersion: "2.0",
      confirm: true,
    })
  })
  it("shows accrued overage, the projected invoice and a reached cap; members cannot change it", () => {
    render(
      <TeamApiDashboard
        initial={{
          ...initial,
          organiser: false,
          overage: {
            enabled: true,
            capPence: 1000,
            revision: 2,
            updatedAt: null,
          },
          accrued: {
            requestsPence: 900,
            bytesPence: 75,
            creditsPence: 50,
            totalPence: 1025,
          },
          projectedInvoicePence: 11_025,
        }}
        confirming={false}
        section="usage"
      />
    )
    expect(screen.getByText("£10.25")).toBeTruthy()
    expect(screen.getByText("£110.25")).toBeTruthy()
    expect(screen.getByText("Overage cap reached")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Update cap" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Turn off overage" })
    ).toBeNull()
  })
})
