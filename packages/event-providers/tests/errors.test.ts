import { describe, expect, it } from "vitest"

import {
  classifyFailure,
  FeedFormatError,
  FetchTimeoutError,
  ProviderStatusError,
  ResponseTooLargeError,
  UnsafeUrlError,
} from "../src"

describe("ProviderStatusError", () => {
  // Finding 8 (T2): never takes a URL — a feed URL can carry a secret
  // token, and this message reaches logs and the credential's own
  // `lastErrorMessage`.
  it("never includes a URL in its message", () => {
    const err = new ProviderStatusError("ical", 404)
    expect(err.message).toBe("ical returned 404")
    expect(err.message).not.toMatch(/https?:\/\//)
  })
})

describe("classifyFailure", () => {
  it.each([
    [new ProviderStatusError("eventbrite", 401), "auth_failed"],
    [new ProviderStatusError("eventbrite", 403), "auth_failed"],
    [new ProviderStatusError("ical", 404), "not_found"],
    [new ProviderStatusError("ical", 410), "not_found"],
    [new ProviderStatusError("ical", 429), "rate_limited"],
    [new ProviderStatusError("ical", 500), "provider_error"],
    [new FeedFormatError("not ical"), "unrecognised_format"],
    [new ResponseTooLargeError(5), "unrecognised_format"],
    [new UnsafeUrlError("blocked"), "unreachable"],
    [new FetchTimeoutError(15000), "unreachable"],
    [
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND" },
      }),
      "unreachable",
    ],
    [new Error("something odd"), "provider_error"],
  ] as const)("%s → %s", (err, code) => {
    expect(classifyFailure(err)).toBe(code)
  })
})
