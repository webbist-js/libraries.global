import { NextResponse } from "next/server"

/**
 * Fixed-window rate limiting for route handlers.
 *
 * The store is pluggable. `MemoryRateLimitStore` is per process, so on Vercel
 * each function instance counts on its own: enough to blunt scripted abuse of
 * a form, not a hard global cap. Swap in a shared store (Postgres, Redis)
 * by implementing `RateLimitStore.hit` when a cross-instance limit is needed.
 * Better Auth keeps its own limiter (its `rateLimit` table) for /api/auth/*
 * and doesn't expose it for other routes.
 */

export interface RateLimitStore {
  /**
   * Record one hit for `key` and return the count in the current window and
   * when that window ends. A new window starts when the old one has passed.
   */
  hit: (
    key: string,
    windowMs: number,
    now: number
  ) => Promise<{ count: number; resetAt: number }>
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  /** Seconds until the window resets; meaningful when `ok` is false. */
  retryAfterSeconds: number
}

export type RateLimiter = {
  check: (key: string, now?: number) => Promise<RateLimitResult>
}

type Window = { count: number; resetAt: number }

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, Window>()
  private readonly maxKeys: number

  constructor({ maxKeys = 10_000 }: { maxKeys?: number } = {}) {
    this.maxKeys = maxKeys
  }

  get size(): number {
    return this.windows.size
  }

  async hit(key: string, windowMs: number, now: number) {
    const current = this.windows.get(key)
    if (current && current.resetAt > now) {
      current.count += 1
      // Re-insert so Map order stays oldest-first for eviction.
      this.windows.delete(key)
      this.windows.set(key, current)

      return { count: current.count, resetAt: current.resetAt }
    }

    this.windows.delete(key)
    if (this.windows.size >= this.maxKeys) this.prune(now)

    const fresh = { count: 1, resetAt: now + windowMs }
    this.windows.set(key, fresh)

    return { ...fresh }
  }

  /** Drop expired windows; if none expired, drop the oldest entries. */
  private prune(now: number) {
    for (const [key, window] of this.windows)
      if (window.resetAt <= now) this.windows.delete(key)
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value
      if (oldest === undefined) break
      this.windows.delete(oldest)
    }
  }
}

// One shared in-memory store per process; limiters are namespaced by name.
const globalForRateLimit = globalThis as typeof globalThis & {
  _rateLimitStore?: MemoryRateLimitStore
}
const defaultStore = () =>
  (globalForRateLimit._rateLimitStore ??= new MemoryRateLimitStore())

export function createRateLimiter({
  name,
  max,
  windowMs,
  store,
}: {
  /** Namespace, so two limiters can share a store without sharing counts. */
  name: string
  max: number
  windowMs: number
  store?: RateLimitStore
}): RateLimiter {
  return {
    async check(key, now = Date.now()) {
      const { count, resetAt } = await (store ?? defaultStore()).hit(
        `${name}:${key}`,
        windowMs,
        now
      )

      return {
        ok: count <= max,
        remaining: Math.max(0, max - count),
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    },
  }
}

/** The 429 a route returns when `check` said no. */
export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  )
}

// Loose IPv4/IPv6 shape: enough to keep header junk out of limiter keys.
const IP_PATTERN = /^[\d.a-f:]{3,45}$/i

/**
 * The client's address from the proxy headers Vercel sets, or "unknown".
 * Only the first X-Forwarded-For entry counts: later ones are appended by
 * proxies, the first is the connecting client as the edge saw it.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const candidate = forwarded || req.headers.get("x-real-ip")?.trim() || ""

  return IP_PATTERN.test(candidate) ? candidate.toLowerCase() : "unknown"
}
