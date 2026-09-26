/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist / test fixtures */
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

/**
 * SSRF guard for provider requests whose URL comes from user-submitted
 * credentials (feed URLs, catalogue base URLs). Rejects non-HTTP(S) schemes and
 * any host that resolves to a loopback, private, link-local, CGNAT or
 * cloud-metadata address, and re-checks every redirect hop.
 *
 * Note: this checks resolution at request time; it does not pin the resolved
 * IP, so it narrows but does not fully close DNS-rebinding. Run the worker
 * without access to sensitive internal services as defence in depth.
 */

const MAX_REDIRECTS = 5

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeUrlError"
  }
}

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

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return BLOCKED_V4.some((cidr) => inV4Range(address, cidr))
  if (family === 6) {
    const a = address.toLowerCase()
    // IPv4-mapped (::ffff:10.0.0.1) — check the embedded v4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a)
    if (mapped) return isBlockedAddress(mapped[1]!)

    return (
      a === "::" ||
      a === "::1" ||
      a.startsWith("fc") ||
      a.startsWith("fd") ||
      a.startsWith("fe8") ||
      a.startsWith("fe9") ||
      a.startsWith("fea") ||
      a.startsWith("feb") ||
      a.startsWith("ff")
    )
  }

  return true
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError("Invalid URL")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new UnsafeUrlError(`Unsupported URL scheme: ${url.protocol}`)

  const host = url.hostname.replaceAll(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((r) => r.address)
  if (addresses.length === 0 || addresses.some(isBlockedAddress))
    throw new UnsafeUrlError(
      `Refusing to fetch non-public host: ${url.hostname}`
    )

  return url
}

/** fetch() for user-supplied URLs. Follows redirects manually, re-validating each hop. */
export async function safeFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  let current = input
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current)
    const res = await fetch(current, { ...init, redirect: "manual" })
    const location = res.headers?.get?.("location")
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString()
      continue
    }

    return res
  }
  throw new UnsafeUrlError("Too many redirects")
}
