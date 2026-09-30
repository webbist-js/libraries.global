/* eslint-disable sonarjs/no-hardcoded-ip -- fixture addresses for the per-IP limiter */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/subscriber/controllers/subscriber"
import { subscriberRateLimiter } from "../src/api/subscriber/rate-limit"

const SUBSCRIBER = "api::subscriber.subscriber"

function ctx(
  body: unknown,
  {
    secret = "s3cret",
    forwardedFor,
    ip = "10.0.0.1",
  }: { secret?: string | null; forwardedFor?: string; ip?: string } = {}
) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers["x-service-secret"] = secret
  if (forwardedFor !== undefined) headers["x-forwarded-for"] = forwardedFor
  const c: any = {
    request: { body, headers, header: headers, ip },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    tooManyRequests: (m: string) => ((c.status = 429), (c.body = m)),
  }

  return c
}

describe("POST /subscribers (E6)", () => {
  let fake: any
  let controller: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    subscriberRateLimiter.reset()
    fake = makeFakeStrapi({
      [SUBSCRIBER]: [{ documentId: "n1", email: "Existing@Example.org" }],
    })
    controller = factory({
      strapi: { ...fake.strapi, contentType: () => ({ uid: SUBSCRIBER }) },
    } as any)
  })
  afterEach(() => subscriberRateLimiter.reset())

  it("refuses without the bridge secret", async () => {
    const c = ctx({ email: "new@example.org" }, { secret: null })
    await controller.subscribe(c)
    expect(c.status).toBe(401)

    const wrong = ctx({ email: "new@example.org" }, { secret: "nope" })
    await controller.subscribe(wrong)
    expect(wrong.status).toBe(401)
    expect(fake.store[SUBSCRIBER]).toHaveLength(1)
  })

  it("creates a subscriber from { email } with a server-written message", async () => {
    const c = ctx({ email: "  New@Example.com " })
    await controller.subscribe(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ ok: true })
    expect(fake.store[SUBSCRIBER]).toHaveLength(2)
    const row = fake.store[SUBSCRIBER][1]
    expect(row.email).toBe("new@example.com")
    expect(row.message).toMatch(
      /^Signed up via the website footer on \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    )
    expect(row.name).toBeUndefined()
    expect(row.content).toBeUndefined()
  })

  it.each([
    ["missing", {}],
    ["not a string", { email: 42 }],
    ["malformed", { email: "not-an-email" }],
    ["too long", { email: `${"a".repeat(250)}@example.org` }],
    ["carrying other fields", { email: "a@example.org", name: "x" }],
    ["carrying a message", { email: "a@example.org", message: "hi" }],
    ["not an object", "a@example.org"],
  ])("rejects a body that is %s", async (_label, body) => {
    const c = ctx(body)
    await controller.subscribe(c)

    expect(c.status).toBe(400)
    expect(fake.store[SUBSCRIBER]).toHaveLength(1)
  })

  it("dedupes case-insensitively and still answers ok", async () => {
    const c = ctx({ email: "existing@example.org" })
    await controller.subscribe(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ ok: true })
    expect(fake.store[SUBSCRIBER]).toHaveLength(1)
  })

  it("allows five sign-ups an hour per client IP, taken from X-Forwarded-For", async () => {
    for (let i = 0; i < 5; i++) {
      const c = ctx(
        { email: `p${i}@example.org` },
        { forwardedFor: "203.0.113.9, 10.0.0.1" }
      )
      await controller.subscribe(c)
      expect(c.status).toBe(200)
    }
    const sixth = ctx(
      { email: "p6@example.org" },
      { forwardedFor: "203.0.113.9, 10.0.0.1" }
    )
    await controller.subscribe(sixth)
    expect(sixth.status).toBe(429)
    expect(fake.store[SUBSCRIBER]).toHaveLength(6)

    // Another client is not affected.
    const other = ctx(
      { email: "q@example.org" },
      { forwardedFor: "198.51.100.4" }
    )
    await controller.subscribe(other)
    expect(other.status).toBe(200)
  })

  it("falls back to the socket address without X-Forwarded-For", async () => {
    for (let i = 0; i < 5; i++) {
      await controller.subscribe(
        ctx({ email: `r${i}@example.org` }, { ip: "10.9.9.9" })
      )
    }
    const sixth = ctx({ email: "r6@example.org" }, { ip: "10.9.9.9" })
    await controller.subscribe(sixth)
    expect(sixth.status).toBe(429)
  })
})
