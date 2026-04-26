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

  const body = (await req.json()) as {
    libraryEntityRef: string
    libraryName: string
    libraryWebsite?: string
    role?: string
    department?: string
  }

  const { libraryEntityRef, libraryName, libraryWebsite, role, department } =
    body
  if (!libraryEntityRef || !libraryName)
    return NextResponse.json(
      { error: "libraryEntityRef and libraryName are required" },
      { status: 400 }
    )

  // Check email domain vs library website domain
  const emailDomain = session.user.email.split("@")[1]?.toLowerCase() ?? ""
  const libraryDomain = libraryWebsite ? extractDomain(libraryWebsite) : ""
  const domainMatch =
    emailDomain.length > 0 &&
    libraryDomain.length > 0 &&
    emailDomain === libraryDomain

  if (domainMatch) {
    // Auto-verify via upsert-profile
    const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({
        baUserId: session.user.id,
        claimedLibraryEntityRef: libraryEntityRef,
        claimedLibraryName: libraryName,
        claimedLibraryRole: role ?? "",
        claimedLibraryDepartment: department ?? "",
        affiliationVerificationStatus: "verified",
        affiliationVerificationMethod: "email_domain",
        isVerifiedLibrarian: true,
      }),
    })
    if (!res.ok)
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )

    return NextResponse.json({ status: "verified", method: "email_domain" })
  }

  // Check if there are verified librarians at this library (for vouching)
  const vouchCheckRes = await fetch(
    `${STRAPI}/api/user-profiles?filters[claimedLibraryEntityRef][$eq]=${encodeURIComponent(libraryEntityRef)}&filters[isVerifiedLibrarian][$eq]=true&fields[0]=id`,
    { next: { revalidate: 0 } }
  )
  let verificationMethod = "contact_us"
  if (vouchCheckRes.ok) {
    const vouchJson = (await vouchCheckRes.json()) as { data: unknown[] }
    if (vouchJson.data.length > 0) verificationMethod = "vouching"
  }

  // Update profile to pending
  await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      claimedLibraryEntityRef: libraryEntityRef,
      claimedLibraryName: libraryName,
      claimedLibraryRole: role ?? "",
      claimedLibraryDepartment: department ?? "",
      affiliationVerificationStatus: "pending",
      affiliationVerificationMethod: verificationMethod,
    }),
  })

  // Create moderation submission
  const submissionRes = await fetch(
    `${STRAPI}/api/content-moderation/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({
        baUserId: session.user.id,
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
