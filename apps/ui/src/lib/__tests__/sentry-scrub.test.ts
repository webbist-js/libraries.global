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
