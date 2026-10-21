import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

const limiter = createRateLimiter({
  name: "claim-library",
  max: 30,
  windowMs: 60_000,
})

const OPEN_STATUSES = new Set(["pending", "needs_info"])

/**
 * Whether the user already has a claim for this library waiting on
 * moderation. Read from their own submissions listing; if that can't be read,
 * the claim goes ahead (Strapi's policy is the final gate).
 */
async function hasOpenClaim(
  user: { id: string; email: string; name?: string | null },
  entityRef: string
): Promise<boolean> {
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      headers: userHeaders(user),
      cache: "no-store",
    })
    if (!res.ok) return false
    const json = (await res.json()) as {
      data?: {
        submissionType?: string
        status?: string
        targetSlug?: string | null
      }[]
    }

    return (json.data ?? []).some(
      (s) =>
        s.submissionType === "library_claim" &&
        OPEN_STATUSES.has(s.status ?? "") &&
        s.targetSlug === entityRef
    )
  } catch {
    return false
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)

    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const parsed = await readTypedJson(
    req,
    16384,
    z
      .object({
        libraryEntityRef: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .regex(/^[a-zA-Z0-9._:-]+$/),
        libraryName: z.string().trim().min(1).max(500),
        libraryWebsite: z.string().trim().max(2048).optional(),
        role: z.string().trim().max(200).optional(),
        department: z.string().trim().max(200).optional(),
      })
      .strict()
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const { libraryEntityRef, libraryName, libraryWebsite, role, department } =
    parsed.body

  // Block duplicate claims — check if user already has an affiliation for this library
  const existingRes = await fetch(
    `${STRAPI}/api/auth-bridge/claim-status?baUserId=${encodeURIComponent(session.user.id)}&entityRef=${encodeURIComponent(libraryEntityRef)}`,
    { headers: { "X-Service-Secret": SECRET }, cache: "no-store" }
  )
  if (existingRes.ok) {
    const existingJson = (await existingRes.json()) as {
      claimedLibraryEntityRef: string | null
    }
    if (existingJson.claimedLibraryEntityRef) {
      return NextResponse.json(
        {
          error: "already_claimed",
          message: "You have already claimed this library.",
        },
        { status: 409 }
      )
    }
  }

  // One open claim per library per user: a second one would only queue up
  // behind the first in moderation.
  if (await hasOpenClaim(session.user, libraryEntityRef))
    return NextResponse.json(
      {
        error: "claim_pending",
        message: "Your claim for this library is already waiting for review.",
      },
      { status: 409 }
    )

  // Email-domain auto-verification. Strapi compares the domain of this
  // (verified) session email with the library's stored website/email and
  // refuses on mismatch, so nothing from the request body is trusted here.
  const emailDomain = session.user.email.split("@")[1]?.toLowerCase() ?? ""
  if (session.user.emailVerified) {
    const res = await fetch(`${STRAPI}/api/auth-bridge/create-affiliation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({
        baUserId: session.user.id,
        entityRef: libraryEntityRef,
        role: role ?? "",
        department: department ?? "",
        verificationMethod: "email_domain",
        userEmail: session.user.email,
        emailVerified: true,
      }),
    })
    if (res.ok)
      return NextResponse.json({ status: "verified", method: "email_domain" })
    if (res.status === 404)
      return NextResponse.json({ error: "Library not found" }, { status: 404 })
    // 403 (domain mismatch) falls through to the moderated claim flow.
    if (res.status !== 403)
      return NextResponse.json(
        { error: "Failed to create affiliation" },
        { status: 500 }
      )
  }

  // Check if there are existing verified librarians at this library (for vouching)
  let verificationMethod = "contact_us"
  const vouchRes = await fetch(
    `${STRAPI}/api/auth-bridge/affiliation-count?entityRef=${encodeURIComponent(libraryEntityRef)}`,
    { headers: { "X-Service-Secret": SECRET }, cache: "no-store" }
  )
  if (vouchRes.ok) {
    const vouchJson = (await vouchRes.json()) as { count: number }
    if (vouchJson.count > 0) verificationMethod = "vouching"
  }

  // Create moderation submission — affiliation will be created on approval
  const submissionRes = await fetch(
    `${STRAPI}/api/content-moderation/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session.user),
      },
      body: JSON.stringify({
        submissionType: "library_claim",
        targetEntityType: "library",
        targetSlug: libraryEntityRef,
        verificationMethod,
        fields: {
          entityRef: libraryEntityRef,
          name: libraryName,
          role: role ?? "",
          department: department ?? "",
          userEmailDomain: emailDomain,
          claimedWebsiteDomain: libraryWebsite
            ? extractDomain(libraryWebsite)
            : "",
        },
        note: `Library affiliation claim: ${libraryName} (${libraryEntityRef}) — ${verificationMethod}`,
      }),
    }
  )

  if (!submissionRes.ok)
    return NextResponse.json(
      { error: "Failed to submit claim" },
      { status: 500 }
    )

  return NextResponse.json({ status: "pending", method: verificationMethod })
}
