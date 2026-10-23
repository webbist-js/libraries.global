import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  maskEmail,
  notificationConfig,
  postToSlack,
  SlackDeliveryError,
  slackMessage,
} from "../src/utils/internal-notifications/slack"

const event = {
  eventKey: "fixture",
  kind: "contribution",
  title: "Contribution submitted",
  detail: "<!channel> <https://evil.example|Review>",
  eventAt: "2026-10-23T12:00:00Z",
}
beforeEach(() => {
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "2026-10-23T00:00:00Z")
  vi.stubEnv(
    "SLACK_INTERNAL_WEBHOOK_URL",
    "https://hooks.slack.com/services/T123/B123/fixture"
  )
  vi.stubEnv("INTERNAL_NOTIFICATIONS_DRY_RUN", "false")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("configuration and messages", () => {
  it("is disabled by default and requires an explicit activation date", () => {
    vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "false")
    expect(notificationConfig()).toBeNull()
    vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
    vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "")
    expect(() => notificationConfig()).toThrow("activation date")
  })
  it.each([
    "http://hooks.slack.com/services/T/B/key",
    "https://evil.example/services/T/B/key",
    "https://hooks.slack.com/services/T/B/key?leak=1",
    "not-a-url",
  ])("rejects an unsafe webhook without exposing it: %s", (value) => {
    vi.stubEnv("SLACK_INTERNAL_WEBHOOK_URL", value)
    expect(() => notificationConfig()).toThrow(
      "Invalid internal Slack webhook configuration"
    )
  })
  it("keeps untrusted text in plain blocks and rejects external action links", () => {
    const payload = slackMessage(
      { ...event, href: "https://evil.example" },
      "test"
    )
    expect(payload.blocks[1]).toEqual({
      type: "section",
      text: { type: "plain_text", text: event.detail, emoji: false },
    })
    expect(payload.blocks).toHaveLength(3)
    expect(payload.unfurl_links).toBe(false)
    expect(payload.text).toContain(event.title)
    expect(payload.text).not.toContain("<!channel>")
    expect(payload.text).toContain("&lt;!channel&gt;")
  })
  it("masks signup addresses", () => {
    expect(maskEmail("person@example.test")).toBe("p***@example.test")
    expect(maskEmail(null)).toBe("Email withheld")
  })
})

describe("delivery", () => {
  it("requires Slack's success response and prohibits redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok"))
    vi.stubGlobal("fetch", fetcher)
    await postToSlack("fixture", slackMessage(event, "test"))
    expect(fetcher).toHaveBeenCalledWith(
      "fixture",
      expect.objectContaining({ redirect: "error", method: "POST" })
    )
  })
  it("respects throttling and classifies invalid credentials as permanent", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("", { status: 429, headers: { "Retry-After": "120" } })
        )
    )
    await expect(
      postToSlack("fixture", slackMessage(event, "test"))
    ).rejects.toMatchObject({ retryAfter: 120, permanent: false })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid_token", { status: 403 }))
    )
    await expect(
      postToSlack("fixture", slackMessage(event, "test"))
    ).rejects.toMatchObject({ code: "slack_http_403", permanent: true })
  })
  it("redacts provider errors that contain the webhook credential", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("https://hooks.slack.com/services/private/credential")
        )
    )
    const error = await postToSlack(
      "fixture",
      slackMessage(event, "test")
    ).catch((e) => e)
    expect(error).toBeInstanceOf(SlackDeliveryError)
    expect(JSON.stringify(error)).not.toContain("credential")
    expect(error.message).toBe("slack_unreachable")
  })
})
