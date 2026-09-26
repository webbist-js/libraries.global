import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

const VALID_PROVIDERS = [
  "eventbrite",
  "ticketsource",
  "meetup",
  "ical",
  "wegottickets",
  "spydus",
  "bibliocommons",
] as const

const PROVIDER_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  ticketsource: "TicketSource",
  meetup: "Meetup",
  ical: "iCal Feed",
  wegottickets: "WeGotTickets",
  spydus: "Spydus",
  bibliocommons: "BiblioCommons",
}

export async function POST(req: Request) {
  // 1. Validate session
  const hdrs = await headers()
  const session = await getSessionSSR(hdrs)
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // 2. Parse body
  let body: {
    provider: string
    libraryDocumentId: string
    libraryEntityRef: string
    libraryName: string
    credentials: Record<string, unknown>
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  // libraryDocumentId from the body is ignored: the affiliation check below is
  // on libraryEntityRef, so the target library is resolved from that instead.
  const { provider, libraryEntityRef, libraryName, credentials } = body

  if (!VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])) {
    return new Response("Invalid provider", { status: 400 })
  }
  if (
    !libraryEntityRef ||
    !credentials ||
    typeof credentials !== "object" ||
    Array.isArray(credentials)
  ) {
    return new Response("Missing required fields", { status: 400 })
  }

  // 3. Verify verified librarian role (server-side re-check)
  const profileRes = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}&fields[0]=isVerifiedLibrarian`,
    {
      cache: "no-store",
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    }
  )
  if (!profileRes.ok) {
    return new Response("Profile lookup failed", { status: 500 })
  }
  const profileData = (await profileRes.json()) as {
    data?: { isVerifiedLibrarian?: boolean }[]
  }
  if (!profileData.data?.[0]?.isVerifiedLibrarian) {
    return new Response("Forbidden: verified librarian role required", {
      status: 403,
    })
  }

  // 4. Verify user is affiliated with the submitted library
  if (!BRIDGE_SECRET) {
    return new Response("Service configuration error", { status: 500 })
  }
  const claimRes = await fetch(
    `${STRAPI}/api/auth-bridge/claim-status?baUserId=${encodeURIComponent(session.user.id)}&entityRef=${encodeURIComponent(libraryEntityRef)}`,
    {
      cache: "no-store",
      headers: { "X-Service-Secret": BRIDGE_SECRET },
    }
  )
  if (!claimRes.ok) {
    return new Response("Affiliation check failed", { status: 500 })
  }
  const claimData = (await claimRes.json()) as {
    isVerifiedLibrarian?: boolean
    claimedLibraryEntityRef?: string | null
  }
  if (claimData.claimedLibraryEntityRef !== libraryEntityRef) {
    return new Response("Forbidden: you are not affiliated with this library", {
      status: 403,
    })
  }

  // Resolve the library's documentId from the verified entityRef.
  const libraryRes = await fetch(
    `${STRAPI}/api/libraries?filters[entityRef][$eq]=${encodeURIComponent(libraryEntityRef)}&fields[0]=documentId&pagination[limit]=1`,
    {
      cache: "no-store",
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    }
  )
  if (!libraryRes.ok) {
    return new Response("Library lookup failed", { status: 500 })
  }
  const libraryJson = (await libraryRes.json()) as {
    data?: { documentId?: string }[]
  }
  const libraryDocumentId = libraryJson.data?.[0]?.documentId
  if (!libraryDocumentId) {
    return new Response("Library not found", { status: 404 })
  }

  // 5. Sanitize credentials — only string values, bounded length
  const sanitized: Record<string, string> = {}
  for (const [k, v] of Object.entries(credentials)) {
    if (typeof v === "string" && v.trim()) {
      sanitized[String(k).slice(0, 64)] = v.slice(0, 2048)
    }
  }
  if (Object.keys(sanitized).length === 0) {
    return new Response("No valid credential fields provided", { status: 400 })
  }

  // 6. Submit to Strapi events plugin — credential created with isActive: false
  const label = `${(libraryName || "Library").slice(0, 100)} — ${PROVIDER_LABELS[provider] ?? provider}`

  const submitRes = await fetch(`${STRAPI}/api/events/credential-submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({
      provider,
      label,
      libraryDocumentId,
      credentials: sanitized,
      submittedByBaUserId: session.user.id,
    }),
  })

  if (!submitRes.ok) {
    return new Response("Credential submission failed", { status: 500 })
  }

  return new Response(null, { status: 201 })
}
