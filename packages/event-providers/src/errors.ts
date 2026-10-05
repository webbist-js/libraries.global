import type { FeedTestCode } from "@repo/shared-data"

import {
  FetchTimeoutError,
  ResponseTooLargeError,
  UnsafeUrlError,
} from "./lib/safe-fetch"

/** A provider answered with a non-2xx status. */
export class ProviderStatusError extends Error {
  readonly status: number
  constructor(provider: string, status: number, url?: string) {
    super(`${provider} returned ${status}${url ? ` for ${url}` : ""}`)
    this.name = "ProviderStatusError"
    this.status = status
  }
}

/** The response arrived but isn't the format the provider expects. */
export class FeedFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedFormatError"
  }
}

const NETWORK_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
])

/** One test code for any failure a provider's test or fetch throws. */
export function classifyFailure(err: unknown): FeedTestCode {
  if (err instanceof ProviderStatusError) {
    if (err.status === 401 || err.status === 403) return "auth_failed"
    if (err.status === 404 || err.status === 410) return "not_found"
    if (err.status === 429) return "rate_limited"

    return "provider_error"
  }
  if (err instanceof FeedFormatError || err instanceof ResponseTooLargeError)
    return "unrecognised_format"
  if (err instanceof UnsafeUrlError || err instanceof FetchTimeoutError)
    return "unreachable"
  const code =
    (err as { cause?: { code?: unknown }; code?: unknown } | null)?.cause
      ?.code ?? (err as { code?: unknown } | null)?.code
  if (typeof code === "string" && NETWORK_CODES.has(code)) return "unreachable"
  if (err instanceof TypeError && /fetch failed/i.test(err.message))
    return "unreachable"

  return "provider_error"
}
