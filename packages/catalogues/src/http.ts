/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist */
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { CatalogueError } from "./types"

/**
 * HTTP client for catalogue requests.
 *
 * Differences from a bare fetch():
 * - every hop (including redirects) is checked against private/loopback ranges,
 *   because catalogue URLs can come from community contributions;
 * - a per-client cookie jar, since most OPACs are session-based;
 * - the redirect chain is recorded (Enterprise encodes record ids in it);
 * - an honest User-Agent and a per-host minimum interval between requests;
 * - anti-bot challenge pages raise `bot_challenge` instead of being solved.
 */

export const DEFAULT_USER_AGENT =
  "libraries.global-catalogue-bot/0.1 (+https://www.libraries.global/wiki/catalogues)"

const MAX_REDIRECTS = 8
const MAX_BODY_BYTES = 5 * 1024 * 1024

export interface HttpClientOptions {
  userAgent?: string
  /** Per-request timeout. */
  timeoutMs?: number
  /** Minimum gap between two requests to the same host. */
  minIntervalMs?: number
  fetchImpl?: typeof fetch
  /** Throws when a URL is not safe to fetch. Defaults to `assertPublicUrl`. */
  hostGuard?: (url: URL) => Promise<void>
}

export interface RequestOptions {
  headers?: Record<string, string>
  /** Statuses (beyond 2xx) that should not throw. */
  allowStatus?: number[]
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  /** Final URL after redirects. */
  url: string
  /** Every URL visited before the final one. */
  redirects: string[]
  headers: Headers
  text: string
  json: <T = unknown>() => T
}

// ── SSRF guard ──────────────────────────────────────────────────────────────

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
]

function ipv4ToInt(ip: string): number {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  )
}

function inV4Range(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/")
  const bits = Number(bitsStr)
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0

  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base!) & mask)
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return BLOCKED_V4.some((cidr) => inV4Range(address, cidr))
  if (family === 6) {
    const a = address.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a)
    if (mapped) return isBlockedAddress(mapped[1]!)

    return (
      a === "::" ||
      a === "::1" ||
      /^f[cd]/.test(a) ||
      /^fe[89ab]/.test(a) ||
      a.startsWith("ff")
    )
  }

  return true
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new CatalogueError(
      "unsafe_url",
      `Unsupported URL scheme: ${url.protocol}`
    )

  const host = url.hostname.replaceAll(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((r) => r.address)
  if (addresses.length === 0 || addresses.some(isBlockedAddress))
    throw new CatalogueError(
      "unsafe_url",
      `Refusing to fetch non-public host: ${url.hostname}`
    )
}

// ── Bot challenges ──────────────────────────────────────────────────────────

// Only markers that appear on the interstitial itself: Cloudflare and Incapsula
// also inject scripts into ordinary pages, so their generic markers would misfire.
const CHALLENGE_MARKERS = [
  "leastFactor(n)", // Liferay/Arena JS cookie challenge
  "window._cf_chl_opt", // Cloudflare managed challenge
  "<title>Just a moment...</title>", // Cloudflare interstitial
  "Incapsula incident ID",
  'id="anubis_challenge"', // Anubis proof-of-work (served with HTTP 200)
  "Please enable JS and disable any ad blocker", // DataDome
]

export function isBotChallenge(text: string): boolean {
  return CHALLENGE_MARKERS.some((m) => text.includes(m))
}

/** A CDN refusing non-browser clients outright (e.g. Akamai "Access Denied"). */
export function isAccessDenied(status: number, text: string): boolean {
  return status === 403 && /<title>\s*Access Denied\s*<\/title>/i.test(text)
}

// ── Throttle ────────────────────────────────────────────────────────────────

const lastRequestAt = new Map<string, number>()

async function throttle(host: string, minIntervalMs: number): Promise<void> {
  if (minIntervalMs <= 0) return
  const now = Date.now()
  const earliest = (lastRequestAt.get(host) ?? 0) + minIntervalMs
  lastRequestAt.set(host, Math.max(now, earliest))
  if (earliest > now) await new Promise((r) => setTimeout(r, earliest - now))
}

// ── Client ──────────────────────────────────────────────────────────────────

export class CatalogueHttp {
  private readonly cookies = new Map<string, Map<string, string>>()
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly minIntervalMs: number
  private readonly fetchImpl: typeof fetch
  private readonly hostGuard: (url: URL) => Promise<void>

  constructor(options: HttpClientOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.minIntervalMs = options.minIntervalMs ?? 250
    this.fetchImpl = options.fetchImpl ?? fetch
    this.hostGuard = options.hostGuard ?? assertPublicUrl
  }

  get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.request("GET", url, undefined, options)
  }

  post(
    url: string,
    body: string,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    return this.request("POST", url, body, options)
  }

  /** Adds a cookie to the jar, for connectors that must set one by hand. */
  setCookie(host: string, name: string, value: string): void {
    const jar = this.cookies.get(host) ?? new Map<string, string>()
    jar.set(name, value)
    this.cookies.set(host, jar)
  }

  /**
   * A cookie the jar holds for a host, including ones set during redirects.
   * Pass a RegExp when the name varies (e.g. carries the port).
   */
  getCookie(host: string, name: string | RegExp): string | undefined {
    const jar = this.cookies.get(host)
    if (!jar) return undefined
    if (typeof name === "string") return jar.get(name)
    for (const [k, v] of jar) if (name.test(k)) return v

    return undefined
  }

  private cookieHeader(host: string): string | undefined {
    const jar = this.cookies.get(host)
    if (!jar || jar.size === 0) return undefined

    return [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
  }

  private storeCookies(host: string, headers: Headers): void {
    const setCookies =
      typeof headers.getSetCookie === "function" ? headers.getSetCookie() : []
    for (const raw of setCookies) {
      const pair = raw.split(";")[0] ?? ""
      const eq = pair.indexOf("=")
      if (eq <= 0) continue
      this.setCookie(host, pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  private async request(
    method: "GET" | "POST",
    input: string,
    body: string | undefined,
    options: RequestOptions
  ): Promise<HttpResponse> {
    let current: URL
    try {
      current = new URL(input)
    } catch {
      throw new CatalogueError("invalid_input", `Invalid URL: ${input}`)
    }

    const redirects: string[] = []
    let currentMethod = method
    let currentBody = body

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.hostGuard(current)
      await throttle(current.host, this.minIntervalMs)

      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.8",
        ...options.headers,
      }
      const cookie = this.cookieHeader(current.host)
      if (cookie) headers.Cookie = cookie

      let res: Response
      try {
        res = await this.fetchImpl(current.toString(), {
          method: currentMethod,
          headers,
          body: currentBody,
          redirect: "manual",
          signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
        })
      } catch (err) {
        const e = err as Error
        if (e.name === "TimeoutError" || e.name === "AbortError")
          throw new CatalogueError("timeout", `Timed out: ${current.host}`)
        throw new CatalogueError(
          "http",
          `Request to ${current.host} failed: ${e.message}`
        )
      }

      this.storeCookies(current.host, res.headers)

      const location = res.headers.get("location")
      if (res.status >= 300 && res.status < 400 && location) {
        redirects.push(current.toString())
        current = new URL(location, current)
        // 303 (and historically 301/302) turn POSTs into GETs.
        if (res.status !== 307 && res.status !== 308) {
          currentMethod = "GET"
          currentBody = undefined
        }
        continue
      }

      const text = await readCapped(res)
      if (isBotChallenge(text))
        throw new CatalogueError(
          "bot_challenge",
          `${current.host} served an anti-bot challenge`
        )

      if (isAccessDenied(res.status, text))
        throw new CatalogueError(
          "blocked",
          `${current.host} refuses non-browser clients`
        )

      const ok =
        (res.status >= 200 && res.status < 300) ||
        (options.allowStatus ?? []).includes(res.status)
      if (!ok)
        throw new CatalogueError(
          "http",
          `${current.host} responded ${res.status}`
        )

      const finalUrl = current.toString()

      return {
        status: res.status,
        url: finalUrl,
        redirects,
        headers: res.headers,
        text,
        json: <T>() => {
          try {
            return JSON.parse(text) as T
          } catch {
            throw new CatalogueError(
              "parse",
              `Expected JSON from ${new URL(finalUrl).host}`
            )
          }
        },
      }
    }

    throw new CatalogueError("http", "Too many redirects")
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return ""
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new CatalogueError("http", "Response body too large")
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks).toString("utf8")
}
