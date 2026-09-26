import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readStatus } from "../src/utils/read-status"

describe("readStatus", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    delete process.env.STRAPI_BRIDGE_SECRET
  })
  const ctx = (status?: string, secret?: string) => ({
    query: status ? { status } : {},
    request: { headers: secret ? { "x-service-secret": secret } : {} },
  })
  it("defaults to published", () => expect(readStatus(ctx())).toBe("published"))
  it("ignores ?status=draft without the secret", () =>
    expect(readStatus(ctx("draft"))).toBe("published"))
  it("ignores a wrong secret", () =>
    expect(readStatus(ctx("draft", "nope"))).toBe("published"))
  it("allows draft with the secret", () =>
    expect(readStatus(ctx("draft", "s3cret"))).toBe("draft"))
})
