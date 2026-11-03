import "server-only"

/** Only the server transport may reach Strapi's public-account auth handler. */
export function authUpstreamHeaders(source: Headers, json = false): Headers {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new Error("Authentication transport is not configured")
  const result = new Headers({ "X-Service-Secret": secret })
  for (const name of [
    "cookie",
    "origin",
    "referer",
    "user-agent",
    "accept",
    "x-live-confirm",
  ])
    if (source.has(name)) result.set(name, source.get(name)!)
  if (json) result.set("Content-Type", "application/json")
  // Enable only behind the documented proxy that replaces inbound IP headers.
  if (process.env.AUTH_TRUST_PROXY_IP === "true") {
    const ip = source.get("x-forwarded-for")?.split(",")[0]?.trim()
    if (ip) result.set("X-Auth-Client-IP", ip)
  }

  return result
}

function isAuthPath(path: string): boolean {
  return /^\/api\/auth(?:-internal)?\/[a-z\d-]+(?:\/[a-z\d-]+)*\/?$/.test(path)
}

export function authUpstreamUrl(path: string): URL {
  if (!isAuthPath(path)) throw new Error("Invalid auth upstream path")
  // Only configuration selects the destination. Never resolve caller input as
  // a URL: absolute URLs, encoded separators and dot segments are not paths.
  const url = new URL(process.env.STRAPI_URL ?? "http://127.0.0.1:1337")
  url.pathname = path
  url.search = ""
  url.hash = ""

  return url
}

export async function proxyAuthRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  if (
    !incoming.pathname.startsWith("/api/auth/") ||
    !isAuthPath(incoming.pathname)
  )
    return new Response(null, { status: 404 })
  const url = authUpstreamUrl(incoming.pathname)
  // OAuth state/code and callback parameters remain query data, never a host.
  url.search = incoming.search
  const headers = authUpstreamHeaders(request.headers)
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  let body: ArrayBuffer | undefined
  if (!["GET", "HEAD"].includes(request.method) && request.body) {
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 64 * 1024) {
        await reader.cancel()

        return new Response(null, { status: 413 })
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    body = bytes.buffer
  }
  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  })
  const output = new Headers({ "Cache-Control": "private, no-store" })
  for (const name of ["content-type", "location", "retry-after"])
    if (upstream.headers.has(name))
      output.set(name, upstream.headers.get(name)!)
  for (const cookie of upstream.headers.getSetCookie())
    output.append("set-cookie", cookie)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: output,
  })
}
