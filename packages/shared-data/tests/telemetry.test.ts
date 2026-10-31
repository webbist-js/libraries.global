import { expect, it } from "vitest"

import { scrubTelemetryEvent } from "../telemetry"

it("preserves SDK-only metadata and the live objects it references", () => {
  const runtime = { next: {}, previous: {} }
  const metadata = { request: { socket: runtime }, scope: runtime }
  const originalNext = runtime.next
  const originalPrevious = runtime.previous
  const event = {
    sdkProcessingMetadata: metadata,
    request: { url: "/callback?code=private" },
  }

  expect(scrubTelemetryEvent(event)).toBe(event)
  expect(event.sdkProcessingMetadata).toBe(metadata)
  expect(metadata.scope).toBe(runtime)
  expect(runtime.next).toBe(originalNext)
  expect(runtime.previous).toBe(originalPrevious)
  expect(event.request.url).toBe("/callback")
})

it("still scrubs similarly named fields inside transmitted event data", () => {
  const event = {
    extra: { sdkProcessingMetadata: { token: "private", status: "failed" } },
  }

  expect(scrubTelemetryEvent(event).extra.sdkProcessingMetadata).toEqual({
    status: "failed",
  })
})

it("redacts mailbox addresses in free-text errors", () => {
  expect(
    scrubTelemetryEvent({ message: "Email to person@example.test failed" })
      .message
  ).not.toContain("person@example.test")
})
