import { describe, expect, it } from "vitest"

import { scrubSentryEvent } from "../sentry-scrub"

interface TestEvent {
  message?: string
  request?: {
    url?: string
    method?: string
    data?: unknown
    query_string?: string
    cookies?: Record<string, string>
    headers?: Record<string, string>
  }
}

describe("scrubSentryEvent", () => {
  it("removes credentials from the complete event and transaction envelope", () => {
    const canary = "CANARY_CREDENTIAL_SHOULD_NEVER_LEAVE_APP"
    const event = {
      request: { url: `/auth/reset-password?token=${canary}#private` },
      breadcrumbs: [
        {
          category: "navigation",
          data: { from: `/auth/reset-password?token=${canary}`, to: "/" },
        },
        {
          category: "fetch",
          data: { url: `https://example.org/callback?code=${canary}` },
        },
        { category: "console", data: { arguments: [canary] } },
      ],
      spans: [
        {
          data: {
            "http.url": `/callback?code=${canary}`,
            "db.statement": canary,
          },
        },
      ],
      extra: {
        nested: [{ apiKey: canary, authorization: `Bearer ${canary}` }],
      },
      contexts: { feed: { credentials: { token: canary }, status: "failed" } },
      exception: {
        values: [
          { value: `Failed https://example.org/callback?code=${canary}` },
        ],
      },
      user: {
        id: "user-1",
        email: "private@example.org",
        ip_address: "192.0.2.1",
      },
    }
    const result = scrubSentryEvent(event)
    expect(JSON.stringify(result)).not.toContain(canary)
    expect(JSON.stringify(result)).not.toContain("private@example.org")
    expect(result.user).toEqual({ id: "user-1" })
    expect(result.contexts.feed.status).toBe("failed")
    expect(result.request.url).toBe("/auth/reset-password")
  })
  it("drops the body, cookies and query string, and keeps only the user-agent header", () => {
    const event: TestEvent = {
      request: {
        url: "https://libraries.global/api/contribute/event-feeds",
        method: "POST",
        data: { values: { apiKey: "super-secret" } },
        cookies: { session: "abc" },
        query_string: "token=xyz",
        headers: {
          "user-agent": "Mozilla/5.0",
          cookie: "session=abc",
          authorization: "Bearer xyz",
        },
      },
    }

    const scrubbed = scrubSentryEvent(event)

    expect(scrubbed.request?.data).toBeUndefined()
    expect(scrubbed.request?.cookies).toBeUndefined()
    expect(scrubbed.request?.query_string).toBeUndefined()
    expect(scrubbed.request?.headers).toEqual({ "user-agent": "Mozilla/5.0" })
  })

  it("reduces the request URL to origin and pathname, dropping the query string", () => {
    const event: TestEvent = {
      request: {
        url: "https://libraries.global/api/contribute/event-feeds/eventbrite/callback?code=abc123&state=xyz",
      },
    }

    const scrubbed = scrubSentryEvent(event)

    expect(scrubbed.request?.url).toBe(
      "https://libraries.global/api/contribute/event-feeds/eventbrite/callback"
    )
  })

  it("drops every header when there's no user-agent", () => {
    const event: TestEvent = {
      request: { headers: { authorization: "Bearer xyz" } },
    }

    expect(scrubSentryEvent(event).request?.headers).toEqual({})
  })

  it("leaves events without a request untouched", () => {
    const event: TestEvent = { message: "no request here" }

    expect(scrubSentryEvent(event)).toBe(event)
  })

  it("leaves a malformed URL alone rather than guessing", () => {
    const event: TestEvent = { request: { url: "not-a-url" } }

    expect(scrubSentryEvent(event).request?.url).toBe("not-a-url")
  })
})

it("drops console payloads and redacts bearer-link path segments throughout an envelope", () => {
  const event = {
    request: { url: "https://example.test/" },
    message: "Failed opening /staff/teams/join/SYNTHETIC_PATH_ONLY",
    breadcrumbs: [
      {
        category: "console",
        message: "SYNTHETIC_CONSOLE_ONLY",
        data: { arguments: ["SYNTHETIC_CONSOLE_ONLY"] },
      },
      {
        category: "navigation",
        data: {
          to: "/reset-password/SYNTHETIC_RESET_ONLY?token=SYNTHETIC_QUERY_ONLY",
        },
      },
    ],
  }
  const result = JSON.stringify(scrubSentryEvent(event))
  for (const secret of [
    "SYNTHETIC_PATH_ONLY",
    "SYNTHETIC_CONSOLE_ONLY",
    "SYNTHETIC_RESET_ONLY",
    "SYNTHETIC_QUERY_ONLY",
  ])
    expect(result).not.toContain(secret)
  expect(result).toContain("[Filtered]")
})
