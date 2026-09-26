import { NextResponse } from "next/server"

/**
 * Proxies a live catalogue availability check to Strapi, which runs the
 * catalogue connector. Strapi validates the input and rate-limits; results are
 * cached there for 30 minutes, and here briefly at the edge.
 */
// Per-reader limit: 10 checks a minute per client IP. In-memory, so it's per
// server instance; Strapi also applies a global cap.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) hits.delete(hits.keys().next().value!)

  return recent.length > MAX_PER_WINDOW
}

export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (rateLimited(ip))
    return NextResponse.json(
      { error: "Too many checks. Try again in a minute." },
      { status: 429 }
    )

  const { searchParams } = new URL(req.url)
  const library = searchParams.get("library") ?? ""
  const isbn = (searchParams.get("isbn") ?? "").replaceAll(/[\s-]/g, "")

  if (
    !/^[a-z0-9]{10,40}$/.test(library) ||
    !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)
  )
    return NextResponse.json(
      { error: "Enter a 10 or 13 digit ISBN" },
      { status: 400 }
    )

  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/catalogues/availability?library=${library}&isbn=${isbn}`,
      { cache: "no-store", signal: AbortSignal.timeout(45_000) }
    )
    const body: unknown = await res.json().catch(() => null)

    return NextResponse.json(body ?? { error: "Unexpected response" }, {
      status: res.status,
      headers:
        res.status === 200
          ? {
              "Cache-Control":
                "public, s-maxage=600, stale-while-revalidate=1200",
            }
          : {},
    })
  } catch {
    return NextResponse.json(
      { error: "The catalogue took too long to answer" },
      { status: 504 }
    )
  }
}
