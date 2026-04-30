import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { ContributeCommunitySection } from "./_components/ContributeCommunitySection"
import { ContributeGuidelinesSection } from "./_components/ContributeGuidelinesSection"
import { ContributeHeroSection } from "./_components/ContributeHeroSection"
import { ContributePathCards } from "./_components/ContributePathCards"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function fetchLibraryCount(): Promise<number> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/libraries?pagination[pageSize]=1&pagination[page]=1`,
      {
        next: { revalidate: 3600 },
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return 0
    const json = (await res.json()) as {
      meta?: { pagination?: { total?: number } }
    }

    return json.meta?.pagination?.total ?? 0
  } catch {
    return 0
  }
}

async function fetchMySubmissionStats(
  baUserId: string
): Promise<{ pending: number; approved: number; total: number }> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return { pending: 0, approved: 0, total: 0 }
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": secret,
        "X-Ba-User-Id": baUserId,
        "X-Ba-User-Email": "",
      },
    })
    if (!res.ok) return { pending: 0, approved: 0, total: 0 }
    const json = (await res.json()) as { data?: { status?: string }[] }
    const items = json.data ?? []

    return {
      pending: items.filter(
        (s) => s.status === "pending" || s.status === "needs_info"
      ).length,
      approved: items.filter((s) => s.status === "approved").length,
      total: items.filter((s) => s.status !== "draft").length,
    }
  } catch {
    return { pending: 0, approved: 0, total: 0 }
  }
}

async function fetchProfileRole(
  baUserId: string
): Promise<{ isVerifiedLibrarian: boolean }> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=isVerifiedLibrarian`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return { isVerifiedLibrarian: false }
    const json = (await res.json()) as {
      data?: { isVerifiedLibrarian?: boolean }[]
    }

    return { isVerifiedLibrarian: json.data?.[0]?.isVerifiedLibrarian ?? false }
  } catch {
    return { isVerifiedLibrarian: false }
  }
}

export default async function ContributePage() {
  const session = await getSessionSSR(await headers())

  const [libraryCount, roleData, submissionStats] = await Promise.all([
    fetchLibraryCount(),
    session?.user
      ? fetchProfileRole(session.user.id)
      : Promise.resolve({ isVerifiedLibrarian: false }),
    session?.user
      ? fetchMySubmissionStats(session.user.id)
      : Promise.resolve(null),
  ])

  const heroStats = {
    libraryCount,
    ...(submissionStats
      ? {
          myPending: submissionStats.pending,
          myApproved: submissionStats.approved,
          myTotal: submissionStats.total,
        }
      : {}),
  }

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeHeroSection stats={heroStats} isSignedIn={!!session?.user} />
      <ContributePathCards
        isSignedIn={!!session?.user}
        isVerifiedLibrarian={roleData.isVerifiedLibrarian}
      />
      <ContributeGuidelinesSection />
      <ContributeCommunitySection />
    </div>
  )
}
