/* eslint-disable sonarjs/no-hardcoded-ip -- fixture addresses for the per-IP limiter */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
      [SUBSCRIBER]: [
        {
          documentId: "n1",
          email: "Existing@Example.org",
          type: "newsletter",
          state: "active",
          confirmedAt: "2026-10-01T12:00:00.000Z",
          consentedAt: "2026-10-01T12:00:00.000Z",
        },
      ],
    })
    fake.services["api::subscriber.email-preferences"] = {
      confirmRequest: vi.fn(async () => {}),
    }
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
    expect(row.state).toBe("pending_confirmation")
    expect(
      fake.services["api::subscriber.email-preferences"].confirmRequest
    ).toHaveBeenCalledOnce()
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

  it.each(["en", "cs", "fr"])(
    "keeps beta and newsletter consent separate for the same address in %s",
    async (locale) => {
      await controller.subscribe(
        ctx({
          email: "existing@example.org",
          type: "beta_waitlist",
          locale,
        })
      )
      await controller.subscribe(
        ctx({ email: "EXISTING@example.org", type: "beta_waitlist" })
      )
      const rows = fake.store[SUBSCRIBER]
      expect(rows).toHaveLength(2)
      expect(rows[1]).toMatchObject({
        type: "beta_waitlist",
        source: "beta_landing",
        state: "active",
        communicationLocale: locale,
        baUserId: null,
      })
      expect(rows[1].consentedAt).toBeTruthy()
      expect(rows[1].message).toContain("No newsletter")
    }
  )

  it("attributes only matching newsletters to the authenticated bridge user", async () => {
    for (const [type, email] of [
      ["beta_waitlist", "user@example.org"],
      ["newsletter", "user@example.org"],
      ["newsletter", "other@example.org"],
    ]) {
      const c = ctx({ email, type })
      c.request.headers["x-ba-user-id"] = "account-id"
      c.request.headers["x-ba-user-email"] = "user@example.org"
      await controller.subscribe(c)
    }
    expect(
      fake.store[SUBSCRIBER].slice(1).map((row: any) => row.baUserId)
    ).toEqual([null, "account-id", null])
  })

  it.each(["suppressed"])(
    "preserves %s records on repeated collection",
    async (state) => {
      fake.store[SUBSCRIBER][0].state = state
      await controller.subscribe(ctx({ email: "existing@example.org" }))
      expect(fake.store[SUBSCRIBER][0].state).toBe(state)
    }
  )

  it("supplies new consent for a held legacy row without losing its old message", async () => {
    Object.assign(fake.store[SUBSCRIBER][0], {
      state: "pending_confirmation",
      consentedAt: null,
      message: "Old evidence",
    })
    await controller.subscribe(
      ctx({ email: "existing@example.org", source: "journal" })
    )
    expect(fake.store[SUBSCRIBER][0]).toMatchObject({
      state: "pending_confirmation",
      source: "journal",
      message: "Old evidence",
    })
    expect(fake.store[SUBSCRIBER][0].consentedAt).toBeTruthy()
  })

  it("handles a concurrent insert without masking other write failures", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("duplicate"), { code: "23505" })
      )
    fake.strapi.documents = () => ({ findFirst: async () => null, create })
    controller = factory({
      strapi: { ...fake.strapi, contentType: () => ({ uid: SUBSCRIBER }) },
    } as any)
    const c = ctx({ email: "race@example.org" })
    await controller.subscribe(c)
    expect(c.status).toBe(200)
    create.mockRejectedValue(new Error("Database unavailable"))
    await expect(
      controller.subscribe(ctx({ email: "race@example.org" }))
    ).rejects.toThrow("Database unavailable")
  })

  it("exports only consented, active records for the requested purpose", async () => {
    fake.store[SUBSCRIBER].push(
      {
        documentId: "b1",
        email: "beta@example.org",
        type: "beta_waitlist",
        state: "active",
        consentedAt: "2026-10-10",
      },
      {
        documentId: "b2",
        email: "invited@example.org",
        type: "beta_waitlist",
        state: "active",
        consentedAt: "2026-10-10",
        invitedAt: "2026-10-10",
      },
      {
        documentId: "n2",
        email: "legacy@example.org",
        type: "newsletter",
        state: "active",
      },
      {
        documentId: "n3",
        email: "unsub@example.org",
        type: "newsletter",
        state: "unsubscribed",
        consentedAt: "2026-10-10",
      }
    )
    const c = ctx({})
    c.query = { type: "beta_waitlist" }
    await controller.export(c)
    expect(c.body.data.map((row: any) => row.email)).toEqual([
      "beta@example.org",
    ])
    c.query = { type: "newsletter" }
    await controller.export(c)
    expect(c.body.data.map((row: any) => row.email)).toEqual([
      "Existing@Example.org",
    ])
    expect(c.body.data[0].baUserId).toBeUndefined()
    const unauthorized = ctx({}, { secret: null })
    unauthorized.query = { type: "newsletter" }
    await controller.export(unauthorized)
    expect(unauthorized.status).toBe(401)
  })
})
