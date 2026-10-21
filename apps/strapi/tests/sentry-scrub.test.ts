import { describe, expect, it } from "vitest"

import { scrubSentryEvent } from "../src/utils/sentry-scrub"

/**
 * A thrown error in a bridge route reaches Sentry with the whole Koa request
 * attached. `beforeSend` must strip the service secret, auth material, cookies
 * and the JSON body (email, name, bio) before the event leaves the box.
 */
function bridgeErrorEvent() {
  return {
    event_id: "abc",
    message: "boom",
    request: {
      url: "https://api.libraries.global/api/session-profile",
      method: "POST",
      query_string: "locale=en",
      headers: {
        "X-Service-Secret": "bridge-secret",
        Authorization: "Bearer strapi-jwt",
        Cookie: "koa.sess=abc; better-auth.session=def",
        "x-ba-user-email": "alex@example.com",
        "X-BA-User-Name": "Alex",
        "content-type": "application/json",
        "user-agent": "vitest",
        host: "api.libraries.global",
      },
      cookies: { "koa.sess": "abc" },
      data: { email: "alex@example.com", name: "Alex", bio: "hello" },
    },
    user: {
      id: "42",
      email: "alex@example.com",
      username: "alex",
      ip_address: "203.0.113.9",
    },
  }
}

describe("scrubSentryEvent", () => {
  it("scrubs query strings, breadcrumbs, spans and nested credential values", () => {
    const canary = "CANARY_CREDENTIAL_SHOULD_NEVER_LEAVE_CMS"
    const event = {
      request: {
        url: `https://example.org/callback?code=${canary}`,
        query_string: `code=${canary}`,
        headers: { "x-custom-secret": canary },
      },
      breadcrumbs: [
        { data: { from: `/callback?code=${canary}`, arguments: [canary] } },
      ],
      spans: [{ data: { "url.full": `https://example.org/?token=${canary}` } }],
      extra: { nested: [{ credentials: { apiKey: canary } }] },
    }
    const result = scrubSentryEvent(event)
    expect(JSON.stringify(result)).not.toContain(canary)
    expect(result.request.url).toBe("https://example.org/callback")
    expect(result.request).not.toHaveProperty("query_string")
    expect(result.request.headers).toEqual({})
  })
  it("removes secret, auth and identity headers regardless of case", () => {
    const out = scrubSentryEvent(bridgeErrorEvent())
    const headerKeys = Object.keys(out.request!.headers!).map((k) =>
      k.toLowerCase()
    )
    for (const gone of [
      "x-service-secret",
      "authorization",
      "cookie",
      "x-ba-user-email",
      "x-ba-user-name",
    ])
      expect(headerKeys).not.toContain(gone)
    expect(JSON.stringify(out)).not.toContain("bridge-secret")
    expect(JSON.stringify(out)).not.toContain("strapi-jwt")
    expect(JSON.stringify(out)).not.toContain("koa.sess")
  })

  it("keeps harmless headers, the url and the method", () => {
    const out = scrubSentryEvent(bridgeErrorEvent())
    expect(out.request).toMatchObject({
      url: "https://api.libraries.global/api/session-profile",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
        host: "api.libraries.global",
      },
    })
  })

  it("drops request cookies and the request body", () => {
    const out = scrubSentryEvent(bridgeErrorEvent())
    expect(out.request).not.toHaveProperty("cookies")
    expect(out.request).not.toHaveProperty("data")
    expect(JSON.stringify(out)).not.toContain("alex@example.com")
    expect(JSON.stringify(out)).not.toContain("hello")
  })

  it("reduces the user to its id only", () => {
    const out = scrubSentryEvent(bridgeErrorEvent())
    expect(out.user).toEqual({ id: "42" })
  })

  it("leaves an event with no request or user untouched", () => {
    const out = scrubSentryEvent({ event_id: "x", message: "plain" })
    expect(out).toEqual({ event_id: "x", message: "plain" })
    expect(out).not.toHaveProperty("user")
  })

  it("returns the event so Sentry still sends it", () => {
    const event = bridgeErrorEvent()
    expect(scrubSentryEvent(event)).toBe(event)
  })
})
