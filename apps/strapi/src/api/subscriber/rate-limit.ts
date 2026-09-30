/**
 * In-memory token bucket per key (a client IP): `capacity` requests, refilled
 * at `capacity` per `windowMs`. Process-local, so a multi-instance deploy
 * gets one bucket per instance; that is acceptable for the newsletter form,
 * which the UI route (`/api/newsletter`) also limits.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>()

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000
  ) {}

  /** True when `key` may proceed (a token was taken), false when it is out. */
  take(key: string, now = Date.now()): boolean {
    const refillPerMs = this.capacity / this.windowMs
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: now }
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + (now - bucket.at) * refillPerMs
    )
    bucket.at = now
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket)

      return false
    }
    bucket.tokens -= 1
    this.buckets.delete(key)
    this.buckets.set(key, bucket)
    this.prune(now)

    return true
  }

  reset(): void {
    this.buckets.clear()
  }

  /** Drop full (idle) buckets, oldest first, so the map stays bounded. */
  private prune(now: number) {
    if (this.buckets.size <= this.maxKeys) return
    for (const [key, bucket] of this.buckets) {
      if (this.buckets.size <= this.maxKeys) break
      const refilled =
        bucket.tokens + (now - bucket.at) * (this.capacity / this.windowMs)
      if (refilled >= this.capacity) this.buckets.delete(key)
    }
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value
      if (oldest === undefined) break
      this.buckets.delete(oldest)
    }
  }
}

/** Newsletter sign-ups: five an hour per client IP. */
export const subscriberRateLimiter = new TokenBucketLimiter(5, 60 * 60 * 1000)
