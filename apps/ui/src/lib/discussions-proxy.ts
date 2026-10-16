import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { strapiServiceHeaders, userHeaders } from "@/lib/bridge-user-headers"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"

const ID =
  "(?:[a-z0-9]{20,32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"
const ROUTES: Record<string, RegExp[]> = {
  GET: [
    new RegExp(`^attachments/${ID}$`),
    /^my\/status$/,
    /^subjects$/,
    /^threads$/,
    new RegExp(`^threads/${ID}$`),
    new RegExp(`^threads/${ID}/replies$`),
    new RegExp(`^records/(thread|reply)/${ID}/revisions$`),
    /^my\/records$/,
    /^moderation\/(revisions|reports)$/,
    /^moderation\/sanctions$/,
    new RegExp(`^moderation/threads/${ID}/audit$`),
  ],
  POST: [
    /^attachments$/,
    /^threads$/,
    new RegExp(`^threads/${ID}/replies$`),
    new RegExp(`^records/(thread|reply)/${ID}/(revisions|reports)$`),
    new RegExp(`^moderation/records/(thread|reply)/${ID}/sanctions$`),
  ],
  PUT: [
    new RegExp(`^threads/${ID}/subscription$`),
    new RegExp(`^records/(thread|reply)/${ID}/reaction$`),
    new RegExp(`^moderation/(revisions|reports)/${ID}$`),
    new RegExp(`^moderation/records/(thread|reply)/${ID}$`),
    new RegExp(`^moderation/sanctions/${ID}$`),
    new RegExp(`^my/sanctions/${ID}/appeal$`),
  ],
}
const QUERY_KEYS = new Set([
  "subjectId",
  "targetUid",
  "targetId",
  "targetLocale",
  "language",
  "offset",
  "limit",
  "kind",
  "threadId",
  "recordId",
  "state",
  "view",
  "q",
])
const IMAGE_BYTES = 4 * 1024 * 1024
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

async function boundedBytes(
  stream: ReadableStream<Uint8Array> | null,
  maximum: number
) {
  if (!stream) return null
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    reader.cancel().catch(() => {})
  }, 15000)
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (timedOut) return null
      if (done) break
      total += value.byteLength
      if (total > maximum) {
        await reader.cancel()

        return null
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }

    return bytes
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

/** Private staging has its own strict multipart seam; it never calls public CMS uploads. */
async function discussionImageInput(req: Request) {
  const invalid = (status: 400 | 413 = 400) => ({ ok: false as const, status })
  const contentType = req.headers.get("content-type") ?? ""
  if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType))
    return invalid()
  const bytes = await boundedBytes(req.body, IMAGE_BYTES + 64 * 1024)
  if (!bytes) return invalid(413)
  try {
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes,
    }).formData()
    const allowed = new Set(["file", "subjectId", "altText", "caption"])
    const seen = new Set<string>()
    for (const [key, value] of form) {
      if (!allowed.has(key) || seen.has(key)) return invalid()
      seen.add(key)
      if (key === "file") {
        if (
          !(value instanceof File) ||
          value.size < 1 ||
          !IMAGE_TYPES.has(value.type)
        )
          return invalid()
        if (value.size > IMAGE_BYTES) return invalid(413)
      } else if (
        typeof value !== "string" ||
        value.length > (key === "caption" ? 500 : key === "altText" ? 250 : 64)
      )
        return invalid()
    }
    if (
      !seen.has("file") ||
      !seen.has("subjectId") ||
      !String(form.get("altText") ?? "").trim()
    )
      return invalid()
    if (!new RegExp(`^${ID}$`).test(String(form.get("subjectId"))))
      return invalid()

    return { ok: true as const, form }
  } catch {
    return invalid()
  }
}

export function discussionProxyPath(method: string, path: string[]) {
  const joined = path.join("/")

  return path.every((part) => !part.includes("/") && !part.includes("%")) &&
    ROUTES[method]?.some((route) => route.test(joined))
    ? joined
    : null
}

export async function proxyDiscussion(req: Request, path: string[]) {
  const route = discussionProxyPath(req.method, path)
  if (!route)
    return NextResponse.json(
      { error: "Unknown discussion route" },
      { status: 404 }
    )
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Discussion service unavailable" },
      { status: 503 }
    )
  const session = await auth.api.getSession({ headers: await headers() })
  if (
    !session?.user &&
    (req.method !== "GET" ||
      route.startsWith("my/") ||
      route.startsWith("moderation/"))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: string | FormData | undefined
  if (req.method !== "GET") {
    if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
      return sameOriginResponse()
    if (route === "attachments") {
      const image = await discussionImageInput(req)
      if (!image.ok)
        return NextResponse.json(
          {
            error:
              "Expected one JPEG, PNG or WebP image up to 4 MiB with a subject and alternative text",
          },
          { status: image.status }
        )
      body = image.form
    } else {
      const parsed = await readJsonCapped(req, 96 * 1024)
      if (!parsed.ok)
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: parsed.status }
        )
      if (
        !parsed.body ||
        typeof parsed.body !== "object" ||
        Array.isArray(parsed.body)
      )
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 }
        )
      body = JSON.stringify(parsed.body)
    }
  }
  const query = new URL(req.url).searchParams
  const upstream = new URL(
    `/api/discussions/${route}`,
    process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  )
  let count = 0
  for (const [key, value] of query) {
    if (
      !QUERY_KEYS.has(key) ||
      value.length > 180 ||
      ++count > 15 ||
      upstream.searchParams.has(key)
    )
      return NextResponse.json(
        { error: "Invalid discussion query" },
        { status: 400 }
      )
    upstream.searchParams.set(key, value)
  }
  try {
    const response = await fetch(upstream, {
      method: req.method,
      headers: {
        ...strapiServiceHeaders(),
        ...(session?.user ? userHeaders(session.user) : {}),
        ...(typeof body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body ? { body } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 204)
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "private, no-store" },
      })
    if (route.startsWith("attachments/") && response.ok) {
      const mime = response.headers.get("content-type")?.split(";")[0] ?? ""
      if (!IMAGE_TYPES.has(mime))
        return NextResponse.json(
          { error: "Invalid discussion image response" },
          { status: 503 }
        )
      const bytes = await boundedBytes(response.body, IMAGE_BYTES)
      if (!bytes)
        return NextResponse.json(
          { error: "Discussion image unavailable" },
          { status: 503 }
        )

      return new Response(bytes, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
        },
      })
    }
    const json: unknown = await response.json()

    return NextResponse.json(json, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Discussion service unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    )
  }
}
