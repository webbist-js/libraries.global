import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import { authGateway } from "../auth-gateway"
import {
  authUpstreamHeaders,
  authUpstreamUrl,
  proxyAuthRequest,
} from "../auth-transport"

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
  it.each([
    "/api/auth/%2f%2fexternal.example.test",
    "/api/auth/%252e%252e/auth-internal/retention",
    "/api/auth/..%2fauth-internal/retention",
    "/api/auth/sign-in%5c..%5c..%5cauth-internal/retention",
    "/api/auth-internal/retention",
  ])("rejects ambiguous or internal browser paths: %s", async (path) => {
    setup()
    const fetcher = vi.fn(async () => Response.json(null))
    vi.stubGlobal("fetch", fetcher)
    const response = await proxyAuthRequest(
      new Request(`https://site.example.test${path}`)
    )
    expect(response.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    "https://external.example.test/api/auth/get-session",
    "//external.example.test/api/auth/get-session",
    "/api/auth/../../admin/users",
    "/api/auth/%2e%2e/auth-internal/retention",
  ])("refuses URL resolution from an untrusted path: %s", (path) => {
    setup()
    expect(() => authUpstreamUrl(path)).toThrow("Invalid auth upstream path")
  })

  it.each(["google", "discord"])(
    "keeps %s callback parameters on the configured CMS origin",
    async (provider) => {
      setup()
      const fetcher = vi.fn(async () => Response.json(null))
      vi.stubGlobal("fetch", fetcher)
      const query =
        "?code=synthetic%2Bcode&state=synthetic%2Fstate&callbackURL=https%3A%2F%2Fexternal.example.test"
      await proxyAuthRequest(
        new Request(
          `https://site.example.test/api/auth/callback/${provider}${query}`
        )
      )
      const [url] = fetcher.mock.calls[0] as unknown as [URL]
      expect(url.origin).toBe("http://cms.example.test:1337")
      expect(url.pathname).toBe(`/api/auth/callback/${provider}`)
      expect(url.search).toBe(query)
    }
  )

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
    // Nested domain rows keep their wire strings.
    expect(
      (result?.user.teams[0] as { expiresAt?: unknown } | undefined)?.expiresAt
    ).toBe(date)
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
        // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- Disposable request fixture; never used as a credential.
        body: { password: "synthetic" },
      })
    ).rejects.toThrow("Authentication request failed (403)")
  })
})
