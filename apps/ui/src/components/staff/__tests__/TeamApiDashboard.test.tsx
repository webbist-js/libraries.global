// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ApiDashboard } from "@/lib/team-api/types"

vi.mock("next-intl", () => ({ useLocale: () => "en" }))
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
    const button = screen.getByRole("button", {
      name: "Subscribe to API access",
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(button.disabled).toBe(false)
  })
  it("shows a created secret once and blocks another creation until it is saved", async () => {
    const secret = `lg_api_${"a".repeat(43)}`
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: "key", secret }))
      .mockResolvedValueOnce(Response.json(initial))
    vi.stubGlobal("fetch", fetcher)
    render(<TeamApiDashboard initial={initial} teams={[]} confirming={false} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Council website" },
    })
    fireEvent.submit(
      screen.getByRole("button", { name: "Create key" }).closest("form")!
    )
    await waitFor(() => expect(screen.getByText(secret)).toBeTruthy())
    expect(
      (screen.getByRole("button", { name: "Create key" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "I have saved it" }))
    expect(screen.queryByText(secret)).toBeNull()
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
})
