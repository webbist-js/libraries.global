import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import type {
  ContributingStanding,
  QuickWin,
  TierInfo,
} from "@/lib/types/profile"

import { ContributeCommunitySection } from "./_components/ContributeCommunitySection"
import { ContributeGuidelinesSection } from "./_components/ContributeGuidelinesSection"
import { ContributeHeroSection } from "./_components/ContributeHeroSection"
import { ContributeNavBar } from "./_components/ContributeNavBar"
import { ContributePathCards } from "./_components/ContributePathCards"
import { QuickWinsSection } from "./_components/QuickWinsSection"
import { WelcomeBackWidget } from "./_components/WelcomeBackWidget"

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

async function fetchStanding(
  baUserId: string
): Promise<ContributingStanding | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  if (!secret) return null
  try {
    const res = await fetch(`${strapi}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Ba-User-Id": baUserId,
        "X-Service-Secret": secret,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: {
        globalRank?: number | null
        countryRank?: number | null
        country?: string | null
        tier?: TierInfo
        streak?: number
        totalPoints?: number
        pointsThisMonth?: number
        suggestedAction?: string
      }
    }
    const d = json.data
    if (!d) return null

    const tier = d.tier ?? {
      level: 1,
      name: "Reader",
      nextName: "Indexer",
      nextThreshold: 100,
      progressPercent: 0,
    }
    const pointsToNext =
      tier.nextThreshold != null
        ? tier.nextThreshold - (d.totalPoints ?? 0)
        : null

    // Fetch pending submission count
    const subRes = await fetch(
      `${strapi}/api/content-moderation/submissions/my`,
      {
        cache: "no-store",
        headers: {
          "X-Service-Secret": secret,
          "X-Ba-User-Id": baUserId,
          "X-Ba-User-Email": "",
        },
      }
    )
    let pendingSubmissions = 0
    if (subRes.ok) {
      const subJson = (await subRes.json()) as { data?: { status?: string }[] }
      pendingSubmissions = (subJson.data ?? []).filter(
        (s) => s.status === "pending" || s.status === "needs_info"
      ).length
    }

    return {
      firstName: "", // filled below from profile
      streak: d.streak ?? 0,
      globalRank: d.globalRank ?? null,
      countryRank: d.countryRank ?? null,
      country: d.country ?? null,
      tier,
      totalPoints: d.totalPoints ?? 0,
      pointsToNext: pointsToNext != null ? Math.max(0, pointsToNext) : null,
      nextTierName: tier.nextName,
      pendingSubmissions,
    }
  } catch {
    return null
  }
}

async function fetchQuickWins(baUserId: string): Promise<QuickWin[]> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapi}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&populate[quickWins]=true&fields[0]=quickWinsComputedAt&fields[1]=firstName`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        quickWins?: QuickWin[]
        quickWinsComputedAt?: string
        firstName?: string
      }[]
    }

    return json.data?.[0]?.quickWins ?? []
  } catch {
    return []
  }
}

async function fetchFirstName(baUserId: string): Promise<string> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapi}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=firstName`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return ""
    const json = (await res.json()) as { data?: { firstName?: string }[] }

    return json.data?.[0]?.firstName ?? ""
  } catch {
    return ""
  }
}

export default async function ContributePage() {
  const session = await getSessionSSR(await headers())

  const [
    libraryCount,
    roleData,
    submissionStats,
    standing,
    quickWins,
    firstName,
  ] = await Promise.all([
    fetchLibraryCount(),
    session?.user
      ? fetchProfileRole(session.user.id)
      : Promise.resolve({ isVerifiedLibrarian: false }),
    session?.user
      ? fetchMySubmissionStats(session.user.id)
      : Promise.resolve(null),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user ? fetchQuickWins(session.user.id) : Promise.resolve([]),
    session?.user ? fetchFirstName(session.user.id) : Promise.resolve(""),
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

  // Attach firstName to standing
  const standingWithName: typeof standing = standing
    ? { ...standing, firstName: firstName || "Contributor" }
    : null

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeHeroSection stats={heroStats} isSignedIn={!!session?.user} />
      {session?.user && standingWithName && (
        <div className="mx-auto w-full max-w-[1296px] px-6 py-8 md:px-10">
          <WelcomeBackWidget standing={standingWithName} />
        </div>
      )}
      {session?.user && quickWins.length > 0 && (
        <QuickWinsSection wins={quickWins} />
      )}
      <ContributeNavBar />
      <ContributePathCards
        isSignedIn={!!session?.user}
        isVerifiedLibrarian={roleData.isVerifiedLibrarian}
      />
      <ContributeGuidelinesSection />
      <ContributeCommunitySection />
    </div>
  )
}
