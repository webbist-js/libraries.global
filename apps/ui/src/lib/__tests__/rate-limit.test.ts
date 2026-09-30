import { describe, expect, it } from "vitest"

import {
  clientIp,
  createRateLimiter,
  MemoryRateLimitStore,
  rateLimitResponse,
} from "../rate-limit"

const MINUTE = 60_000

describe("createRateLimiter", () => {
  it("allows up to `max` hits in a window and refuses the next one", async () => {
    const limiter = createRateLimiter({
      name: "t",
      max: 3,
      windowMs: MINUTE,
      store: new MemoryRateLimitStore(),
    })
    const t0 = 1_000_000

    expect((await limiter.check("a", t0)).ok).toBe(true)
    expect((await limiter.check("a", t0 + 1)).ok).toBe(true)
    const third = await limiter.check("a", t0 + 2)
    expect(third).toMatchObject({ ok: true, remaining: 0 })
    const fourth = await limiter.check("a", t0 + 3)
    expect(fourth.ok).toBe(false)
    expect(fourth.retryAfterSeconds).toBe(60)
  })

  it("keeps keys apart", async () => {
    const limiter = createRateLimiter({
      name: "t",
      max: 1,
      windowMs: MINUTE,
      store: new MemoryRateLimitStore(),
    })

    expect((await limiter.check("a", 0)).ok).toBe(true)
    expect((await limiter.check("b", 0)).ok).toBe(true)
    expect((await limiter.check("a", 1)).ok).toBe(false)
  })

  it("starts a fresh window once the old one has passed", async () => {
    const limiter = createRateLimiter({
      name: "t",
      max: 1,
      windowMs: MINUTE,
      store: new MemoryRateLimitStore(),
    })

    expect((await limiter.check("a", 0)).ok).toBe(true)
    expect((await limiter.check("a", MINUTE - 1)).ok).toBe(false)
    expect((await limiter.check("a", MINUTE)).ok).toBe(true)
  })

  it("keeps limiters with different names apart in a shared store", async () => {
    const store = new MemoryRateLimitStore()
    const a = createRateLimiter({ name: "a", max: 1, windowMs: MINUTE, store })
    const b = createRateLimiter({ name: "b", max: 1, windowMs: MINUTE, store })

    expect((await a.check("k", 0)).ok).toBe(true)
    expect((await b.check("k", 0)).ok).toBe(true)
  })

  it("accepts any store that implements hit()", async () => {
    const calls: string[] = []
    const limiter = createRateLimiter({
      name: "t",
      max: 5,
      windowMs: MINUTE,
      store: {
        async hit(key, windowMs, now) {
          calls.push(key)

          return { count: 99, resetAt: now + windowMs }
        },
      },
    })

    const result = await limiter.check("user-1", 0)

    expect(calls).toEqual(["t:user-1"])
    expect(result.ok).toBe(false)
  })
})

describe("MemoryRateLimitStore", () => {
  it("drops expired windows so the map doesn't grow forever", async () => {
    const store = new MemoryRateLimitStore({ maxKeys: 2 })
    await store.hit("a", MINUTE, 0)
    await store.hit("b", MINUTE, 0)
    await store.hit("c", MINUTE, MINUTE + 1)

    expect(store.size).toBe(1)
  })

  it("evicts the oldest key when full and nothing has expired", async () => {
    const store = new MemoryRateLimitStore({ maxKeys: 2 })
    await store.hit("a", MINUTE, 0)
    await store.hit("b", MINUTE, 1)
    await store.hit("c", MINUTE, 2)

    expect(store.size).toBe(2)
    // "a" was evicted, so it starts over at 1.
    expect((await store.hit("a", MINUTE, 3)).count).toBe(1)
  })
})

describe("rateLimitResponse", () => {
  it("is a 429 with Retry-After", async () => {
    const res = rateLimitResponse({
      ok: false,
      remaining: 0,
      retryAfterSeconds: 42,
    })

    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("42")
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    })
  })
})

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/", { headers })

  it("takes the first X-Forwarded-For address", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9"
    )
  })

  it("falls back to X-Real-IP, then to a fixed key", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5")
    expect(clientIp(req({}))).toBe("unknown")
  })

  it("does not accept junk as an address", () => {
    expect(clientIp(req({ "x-forwarded-for": "<script>" }))).toBe("unknown")
  })
})
