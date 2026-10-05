import { afterEach, describe, expect, it } from "vitest"

import { ProviderStatusError, testFeed } from "../src"
import { __setProviderForTest, __resetProvidersForTest } from "../src/registry"

afterEach(() => __resetProvidersForTest())

const stub = (test: () => Promise<void>) =>
  __setProviderForTest({
    name: "ical",
    eventTypeMap: {},
    test,
    fetch: async () => [],
  })

describe("testFeed", () => {
  it("reports ok when the provider resolves", async () => {
    stub(async () => {})
    expect(
      await testFeed("ical", { feedUrl: "https://x.example/a.ics" })
    ).toEqual({ result: "ok" })
  })

  it("classifies a thrown error and redacts URLs in the detail", async () => {
    stub(async () => {
      throw new ProviderStatusError(
        "ical",
        401,
        "https://x.example/a.ics?token=s3cret"
      )
    })
    const r = await testFeed("ical", {
      feedUrl: "https://x.example/a.ics?token=s3cret",
    })
    expect(r.result).toBe("auth_failed")
    expect(r.detail).not.toContain("s3cret")
  })

  it("answers provider_error for an unknown provider", async () => {
    expect(await testFeed("meetup", {})).toMatchObject({
      result: "provider_error",
    })
  })
})
