import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import { authGateway } from "../auth-gateway"
import { authUpstreamHeaders, proxyAuthRequest } from "../auth-transport"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function setup() {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "synthetic-transport-test")
  vi.stubEnv("STRAPI_URL", "http://cms.example.test:1337")
  vi.stubEnv("AUTH_TRUST_PROXY_IP", "false")
}

describe("Strapi auth transport", () => {
  it("keeps OAuth redirects and every Set-Cookie header", async () => {
    setup()
    const upstream = new Headers({
      location: "https://provider.example.test/authorize",
    })
    upstream.append("set-cookie", "session=a; Path=/; HttpOnly; SameSite=Lax")
    upstream.append("set-cookie", "state=b; Path=/; HttpOnly; SameSite=Lax")
    const fetcher = vi.fn(
      async () => new Response(null, { status: 302, headers: upstream })
    )
    vi.stubGlobal("fetch", fetcher)
    const response = await proxyAuthRequest(
      new Request("https://site.example.test/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://site.example.test",
          cookie: "state=old",
        },
        body: JSON.stringify({ provider: "discord" }),
      })
    )
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "https://provider.example.test/authorize"
    )
    expect(response.headers.getSetCookie()).toEqual(upstream.getSetCookie())
    const [url, options] = fetcher.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ]
    expect(url.href).toBe(
      "http://cms.example.test:1337/api/auth/sign-in/social"
    )
    expect(options.redirect).toBe("manual")
    expect((options.headers as Headers).get("origin")).toBe(
      "https://site.example.test"
    )
    expect((options.headers as Headers).get("cookie")).toBe("state=old")
    expect((options.headers as Headers).get("x-service-secret")).toBe(
      "synthetic-transport-test"
    )
  })

  it("rejects oversized streaming bodies before contacting auth", async () => {
    setup()
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const response = await proxyAuthRequest(
      new Request("https://site.example.test/api/auth/sign-up/email", {
        method: "POST",
        body: "x".repeat(65537),
      })
    )
    expect(response.status).toBe(413)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("does not forward caller-supplied identity, service credentials or IP overrides", () => {
    setup()
    const headers = authUpstreamHeaders(
      new Headers({
        "x-service-secret": "forged",
        "x-ba-user-id": "1",
        "x-auth-client-ip": "192.0.2.1",
        "x-forwarded-for": "192.0.2.2",
        authorization: "Bearer forged",
      })
    )
    expect(headers.get("x-service-secret")).toBe("synthetic-transport-test")
    for (const key of [
      "x-ba-user-id",
      "x-auth-client-ip",
      "x-forwarded-for",
      "authorization",
    ])
      expect(headers.has(key)).toBe(false)
  })

  it("restores base session dates without changing domain entitlement dates", async () => {
    setup()
    const date = "2026-11-03T00:00:00.000Z"
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          user: { id: "1", createdAt: date, teams: [{ expiresAt: date }] },
          session: { id: "2", expiresAt: date },
        })
      )
    )
    const result = await authGateway.api.getSession({ headers: new Headers() })
    expect(result?.session.expiresAt).toEqual(new Date(date))
    expect(result?.user.createdAt).toEqual(new Date(date))
    expect(result?.user.teams[0]?.expiresAt).toBe(date)
  })

  it("fails closed when the upstream refuses a request", async () => {
    setup()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "private diagnostics" }, { status: 403 })
      )
    )
    await expect(
      authGateway.api.verifyPassword({
        headers: new Headers(),
        body: { password: "synthetic" },
      })
    ).rejects.toThrow("Authentication request failed (403)")
  })
})
