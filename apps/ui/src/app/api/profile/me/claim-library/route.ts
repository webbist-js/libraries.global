import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)

    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let body: {
    libraryEntityRef: string
    libraryName: string
    libraryWebsite?: string
    role?: string
    department?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { libraryEntityRef, libraryName, libraryWebsite, role, department } =
    body
  if (!libraryEntityRef || !libraryName)
    return NextResponse.json(
      { error: "libraryEntityRef and libraryName are required" },
      { status: 400 }
    )

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

  // Check email domain vs library website domain
  const emailDomain = session.user.email.split("@")[1]?.toLowerCase() ?? ""
  const libraryDomain = libraryWebsite ? extractDomain(libraryWebsite) : ""
  const domainMatch =
    emailDomain.length > 0 &&
    libraryDomain.length > 0 &&
    emailDomain === libraryDomain

  if (domainMatch) {
    // Auto-verify: create affiliation record + mark profile verified
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
      }),
    })
    if (!res.ok)
      return NextResponse.json(
        { error: "Failed to create affiliation" },
        { status: 500 }
      )

    return NextResponse.json({ status: "verified", method: "email_domain" })
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
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": session.user.id,
        "X-Ba-User-Email": session.user.email,
        "X-Ba-User-Name": session.user.name ?? "",
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
          libraryWebsiteDomain: libraryDomain,
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
