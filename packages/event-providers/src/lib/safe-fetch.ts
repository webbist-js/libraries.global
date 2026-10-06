/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist / test fixtures */
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import ipaddr from "ipaddr.js"
import {
  Agent,
  fetch as undiciFetch,
  Headers,
  type RequestInit,
  type Response,
} from "undici"

import { FeedFormatError } from "./feed-format-error"

/**
 * SSRF guard for provider requests whose URL comes from user-submitted
 * credentials (feed URLs, catalogue base URLs).
 *
 * - Rejects non-HTTP(S) schemes.
 * - Parses every address to bytes (ipaddr.js), unwraps IPv4-mapped,
 *   IPv4-compatible, IPv4-translated, NAT64 and 6to4 forms to the embedded
 *   IPv4 address, then applies the v4 / v6 block lists (loopback, private,
 *   link-local, CGNAT, multicast, reserved, cloud metadata). Teredo is blocked
 *   outright.
 * - Pins the checked address: the request connects through an undici Agent
 *   whose `lookup` returns exactly the addresses that passed the check, so a
 *   DNS answer can't change between check and connect (DNS rebinding).
 * - Re-checks every redirect hop.
 * - Bounds every request with a timeout and every body with a byte cap.
 *
 * Requests go through undici's own `fetch` (not the global one): Node's
 * bundled fetch only accepts a dispatcher from its own undici copy, and the
 * pinned Agent comes from the npm package.
 */

const MAX_REDIRECTS = 5

export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeUrlError"
  }
}

export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response too large (over ${maxBytes} bytes)`)
    this.name = "ResponseTooLargeError"
  }
}

export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`)
    this.name = "FetchTimeoutError"
  }
}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

function cidr4(s: string): [ipaddr.IPv4, number] {
  return ipaddr.IPv4.parseCIDR(s)
}
function cidr6(s: string): [ipaddr.IPv6, number] {
  return ipaddr.IPv6.parseCIDR(s)
}

const BLOCKED_V4 = [
  "0.0.0.0/8", // "this" network
  "10.0.0.0/8", // private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local + cloud metadata
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved + broadcast
].map(cidr4)

const BLOCKED_V6 = [
  "::/128", // unspecified
  "::1/128", // loopback
  "fc00::/7", // unique local
  "fe80::/10", // link-local
  "fec0::/10", // site-local (deprecated)
  "ff00::/8", // multicast
  "2001::/32", // Teredo (embedded v4 is obfuscated; block the tunnel)
  "2001:db8::/32", // documentation
  "2001:2::/48", // benchmarking
  "100::/64", // discard
].map(cidr6)

const NAT64 = cidr6("64:ff9b::/96")
const NAT64_LOCAL = cidr6("64:ff9b:1::/48")
const SIX_TO_FOUR = cidr6("2002::/16")
const V4_COMPAT = cidr6("::/96")
const V4_TRANSLATED = cidr6("::ffff:0:0:0/96")

function v4FromBytes(bytes: number[]): ipaddr.IPv4 {
  return new ipaddr.IPv4(bytes)
}

/** The IPv4 address embedded in a transition-form IPv6 address, if any. */
function embeddedV4(addr: ipaddr.IPv6): ipaddr.IPv4 | null {
  if (addr.isIPv4MappedAddress()) return addr.toIPv4Address()
  const bytes = addr.toByteArray()
  // `IPv6#match(cidr)` is ipaddr.js's range test, not `String#match`.
  /* eslint-disable unicorn/prefer-regexp-test */
  if (addr.match(V4_TRANSLATED)) return v4FromBytes(bytes.slice(12))
  if (addr.match(NAT64)) return v4FromBytes(bytes.slice(12))
  if (addr.match(NAT64_LOCAL)) return v4FromBytes(bytes.slice(12))
  if (addr.match(SIX_TO_FOUR)) return v4FromBytes(bytes.slice(2, 6))
  if (addr.match(V4_COMPAT)) return v4FromBytes(bytes.slice(12))
  /* eslint-enable unicorn/prefer-regexp-test */

  return null
}

function isBlockedV4(addr: ipaddr.IPv4): boolean {
  return BLOCKED_V4.some((range) => addr.match(range))
}

/** True when the address must not be connected to. Unparseable input is blocked. */
export function isBlockedAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6
  try {
    parsed = ipaddr.parse(address)
  } catch {
    return true
  }

  if (parsed.kind() === "ipv4") return isBlockedV4(parsed as ipaddr.IPv4)

  const v6 = parsed as ipaddr.IPv6
  // An embedded v4 (mapped/compat/translated/NAT64/6to4) is judged as that v4.
  // `::` and `::1` fall inside ::/96 but are handled by the v4 list too
  // (0.0.0.0/8), so the order here is safe either way.
  const inner = embeddedV4(v6)
  if (inner) return isBlockedV4(inner)

  return BLOCKED_V6.some((range) => v6.match(range))
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

export interface ResolvedUrl {
  url: URL
  /** Every address the host resolved to; all passed the block list. */
  addresses: string[]
}

function unbracket(hostname: string): string {
  return hostname.replaceAll(/^\[|\]$/g, "")
}

export async function resolvePublicUrl(raw: string): Promise<ResolvedUrl> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError("Invalid URL")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new UnsafeUrlError(`Unsupported URL scheme: ${url.protocol}`)

  // WHATWG URL already normalises numeric hosts (0x7f000001, 2130706433,
  // 127.1 → 127.0.0.1) and bracketed v6 literals to canonical hex form.
  const host = unbracket(url.hostname)
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((r) => r.address)
  if (addresses.length === 0 || addresses.some(isBlockedAddress))
    throw new UnsafeUrlError(
      `Refusing to fetch non-public host: ${url.hostname}`
    )

  return { url, addresses }
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  return (await resolvePublicUrl(raw)).url
}

// ---------------------------------------------------------------------------
// Bounded, pinned fetch
// ---------------------------------------------------------------------------

export interface FetchBounds {
  timeoutMs?: number
  maxBytes?: number
}

export interface BoundedFetchOptions extends FetchBounds {
  /** Addresses (already checked) the connection may be made to. */
  addresses: string[]
}

export interface TextResponse {
  ok: boolean
  status: number
  headers: Headers
  text: string
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number
) => void

/** An undici Agent that only ever connects to `addresses`, whatever DNS says. */
export function pinnedAgent(addresses: string[]): Agent {
  const entries = addresses.map((address) => ({
    address: unbracket(address),
    family: isIP(unbracket(address)),
  }))
  const pinnedLookup = (
    _hostname: string,
    options: { all?: boolean; family?: number } | number,
    callback: LookupCallback
  ) => {
    const opts = typeof options === "object" && options ? options : {}
    const wanted = entries.filter(
      (e) => !opts.family || opts.family === 0 || e.family === opts.family
    )
    const list = wanted.length ? wanted : entries
    if (list.length === 0) {
      callback(
        Object.assign(new Error("No pinned address"), { code: "ENOTFOUND" }),
        []
      )

      return
    }
    if (opts.all) callback(null, list)
    else callback(null, list[0]!.address, list[0]!.family)
  }

  return new Agent({
    connect: { lookup: pinnedLookup as never },
    keepAliveTimeout: 1000,
  })
}

function timeoutSignal(
  timeoutMs: number,
  extra?: RequestInit["signal"] | null
) {
  const timer = AbortSignal.timeout(timeoutMs)
  const signal = extra ? AbortSignal.any([timer, extra as AbortSignal]) : timer

  return { signal, timer }
}

function isTimeout(err: unknown, timer: AbortSignal): boolean {
  if (timer.aborted) return true
  const e = err as { name?: string; cause?: { name?: string } }

  return e?.name === "TimeoutError" || e?.cause?.name === "TimeoutError"
}

/** Read a response body as text, aborting past `maxBytes`. */
export async function readBodyCapped(
  res: Response,
  maxBytes: number
): Promise<string> {
  const declared = Number(res.headers?.get?.("content-length") ?? "")
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new ResponseTooLargeError(maxBytes)

  const body = (res as { body?: ReadableStream<Uint8Array> | null }).body
  if (!body || typeof body.getReader !== "function") {
    // Non-streaming (or mocked) response: fall back to text() and measure.
    const text = typeof res.text === "function" ? await res.text() : ""
    if (Buffer.byteLength(text) > maxBytes)
      throw new ResponseTooLargeError(maxBytes)

    return text
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new ResponseTooLargeError(maxBytes)
    }
    out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()

  return out
}

/**
 * fetch() to a URL whose addresses have already passed the SSRF check:
 * pinned to those addresses, with a whole-request timeout and a body cap.
 * Redirects are not followed (callers re-check each hop).
 */
export async function boundedFetchText(
  input: string,
  init: RequestInit,
  opts: BoundedFetchOptions
): Promise<TextResponse> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const agent = pinnedAgent(opts.addresses)
  const { signal, timer } = timeoutSignal(timeoutMs, init.signal)
  try {
    const res = await undiciFetch(input, {
      ...init,
      redirect: "manual",
      signal,
      dispatcher: agent,
    })
    const text = await readBodyCapped(res, maxBytes)

    return { ok: res.ok, status: res.status, headers: res.headers, text }
  } catch (err) {
    if (isTimeout(err, timer)) throw new FetchTimeoutError(timeoutMs)
    throw err
  } finally {
    await agent.close().catch(() => {})
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

/**
 * Drops `Authorization` and `Cookie` before a request is re-sent to a
 * different origin: a feed URL's credentials (a bearer token, a signed
 * query the server also reads as a cookie) are scoped to the origin the
 * caller meant to call, and undici — unlike a browser — never strips them
 * on its own across a redirect.
 */
function stripCrossOriginAuth(
  headers: RequestInit["headers"]
): RequestInit["headers"] {
  if (!headers) return headers
  const h = new Headers(headers)
  h.delete("authorization")
  h.delete("cookie")

  return h
}

/**
 * fetch() for user-supplied URLs. Follows redirects manually, re-validating
 * and re-pinning each hop. Returns the raw Response; prefer `safeFetchText`,
 * which also caps the body.
 */
export async function safeFetch(
  input: string,
  init: RequestInit = {},
  bounds: FetchBounds = {}
): Promise<Response> {
  const timeoutMs = bounds.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let current = input
  let headers = init.headers
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { addresses } = await resolvePublicUrl(current)
    const agent = pinnedAgent(addresses)
    const { signal, timer } = timeoutSignal(timeoutMs, init.signal)
    let res: Response
    try {
      res = await undiciFetch(current, {
        ...init,
        headers,
        redirect: "manual",
        signal,
        dispatcher: agent,
      })
    } catch (err) {
      await agent.close().catch(() => {})
      if (isTimeout(err, timer)) throw new FetchTimeoutError(timeoutMs)
      throw err
    }
    const location = res.headers?.get?.("location")
    if (res.status >= 300 && res.status < 400 && location) {
      await agent.close().catch(() => {})
      const next = new URL(location, current).toString()
      if (!sameOrigin(next, current)) headers = stripCrossOriginAuth(headers)
      current = next
      continue
    }

    return res
  }
  throw new UnsafeUrlError("Too many redirects")
}

export type SafeFetchTextInit = RequestInit & FetchBounds

/**
 * The provider entry point: SSRF-checked, pinned, timed out, body-capped.
 * Never throws with response content in the message.
 */
export async function safeFetchText(
  input: string,
  init: SafeFetchTextInit = {}
): Promise<TextResponse> {
  const { timeoutMs, maxBytes, ...rest } = init
  let current = input
  let headers = rest.headers
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { addresses } = await resolvePublicUrl(current)
    const res = await boundedFetchText(
      current,
      { ...rest, headers },
      { addresses, timeoutMs, maxBytes }
    )
    const location = res.headers?.get?.("location")
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current).toString()
      if (!sameOrigin(next, current)) headers = stripCrossOriginAuth(headers)
      current = next
      continue
    }

    return res
  }
  throw new UnsafeUrlError("Too many redirects")
}

/** Parse JSON from a bounded response; a parse failure never echoes the body. */
export function parseJsonBody(res: TextResponse, provider: string): any {
  try {
    return JSON.parse(res.text)
  } catch {
    throw new FeedFormatError(`${provider} feed returned unparseable JSON`)
  }
}
