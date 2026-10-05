import {
  EVENT_PROVIDER_KEYS,
  EVENT_PROVIDERS,
  FEED_TEST_BLOCKING,
  FEED_TEST_CODES,
  FEED_TEST_COPY,
  feedHints,
  isEventProviderKey,
  validateFeedValues,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

describe("event provider registry", () => {
  it("lists exactly the seven implemented providers", () => {
    expect([...EVENT_PROVIDER_KEYS].sort()).toEqual([
      "aspen",
      "eventbrite",
      "ical",
      "solus",
      "spydus",
      "ticketsource",
      "wegottickets",
    ])
    expect(Object.keys(EVENT_PROVIDERS).sort()).toEqual(
      [...EVENT_PROVIDER_KEYS].sort()
    )
    expect(isEventProviderKey("meetup")).toBe(false)
  })

  it("names the keys the worker reads", () => {
    const keys = (p: keyof typeof EVENT_PROVIDERS) =>
      EVENT_PROVIDERS[p].fields.map((f) => f.key)
    expect(keys("eventbrite")).toEqual(["organizationId", "accessToken"])
    expect(keys("ical")).toEqual(["feedUrl", "username", "password"])
    expect(keys("ticketsource")).toEqual(["apiKey"])
    expect(keys("wegottickets")).toEqual(["feedUrl"])
    expect(keys("spydus")).toEqual([
      "endpoint",
      "customerKey",
      "username",
      "password",
      "institutionID",
      "locationCode",
    ])
    expect(keys("solus")).toEqual(["endpoint", "secretKey"])
    expect(keys("aspen")).toEqual(["endpoint", "clientId", "clientSecret"])
  })

  it("has copy for every test code and blocks only fixable ones", () => {
    for (const c of FEED_TEST_CODES) expect(FEED_TEST_COPY[c]).toBeTruthy()
    expect([...FEED_TEST_BLOCKING].sort()).toEqual([
      "auth_failed",
      "not_found",
      "unrecognised_format",
    ])
  })
})

describe("validateFeedValues", () => {
  it("accepts a complete Eventbrite value and trims it", () => {
    expect(
      validateFeedValues("eventbrite", {
        organizationId: " 123456789 ",
        accessToken: "ABCDEFGHIJKLMNOP",
      })
    ).toEqual({
      ok: true,
      values: { organizationId: "123456789", accessToken: "ABCDEFGHIJKLMNOP" },
    })
  })

  it("refuses an unknown provider, unknown keys and missing required keys", () => {
    expect(validateFeedValues("meetup", {})).toMatchObject({ ok: false })
    expect(
      validateFeedValues("ticketsource", { apiKey: "k".repeat(20), extra: "x" })
    ).toMatchObject({ ok: false, field: "extra" })
    expect(
      validateFeedValues("solus", { endpoint: "https://x.example" })
    ).toMatchObject({
      ok: false,
      field: "secretKey",
    })
  })

  it("drops empty optional fields", () => {
    expect(
      validateFeedValues("ical", {
        feedUrl: "https://lib.example/cal.ics",
        username: "",
        password: "  ",
      })
    ).toEqual({ ok: true, values: { feedUrl: "https://lib.example/cal.ics" } })
  })

  it("refuses non-http URLs, userinfo and over-long values", () => {
    expect(
      validateFeedValues("ical", { feedUrl: "ftp://x.example/a.ics" })
    ).toMatchObject({ ok: false, field: "feedUrl" })
    expect(
      validateFeedValues("ical", { feedUrl: "https://u:p@x.example/a.ics" })
    ).toMatchObject({ ok: false, field: "feedUrl" })
    expect(
      validateFeedValues("ticketsource", { apiKey: "k".repeat(2049) })
    ).toMatchObject({ ok: false, field: "apiKey" })
  })

  it("refuses a non-object body and non-string values", () => {
    expect(validateFeedValues("ical", null)).toMatchObject({ ok: false })
    expect(validateFeedValues("ical", ["x"])).toMatchObject({ ok: false })
    expect(validateFeedValues("ical", { feedUrl: 5 })).toMatchObject({
      ok: false,
      field: "feedUrl",
    })
  })

  it("checks the Eventbrite organisation id pattern", () => {
    expect(
      validateFeedValues("eventbrite", {
        organizationId: "abc",
        accessToken: "x".repeat(16),
      })
    ).toMatchObject({ ok: false, field: "organizationId" })
  })
})

describe("feedHints", () => {
  it("masks secrets to their last four characters", () => {
    expect(
      feedHints("eventbrite", {
        organizationId: "123456789",
        accessToken: "ABCDEFGHIJKLMNOP",
      })
    ).toEqual({ organizationId: "123456789", accessToken: "••••MNOP" })
  })

  it("hides short secrets entirely and shows only the host of secret URLs", () => {
    expect(
      feedHints("ical", {
        feedUrl: "https://cal.example.org/private/abc123/basic.ics",
        password: "short",
      })
    ).toEqual({
      feedUrl: "https://cal.example.org/…",
      password: "••••",
    })
  })
})
