import { headers } from "next/headers"

import { LibraryCard } from "@/components/ds/LibraryCard"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import type {
  ClaimedLibrary,
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
): Promise<{ isVerifiedLibrarian: boolean; isWikiEditor: boolean }> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=isVerifiedLibrarian&fields[1]=contributorRole`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return { isVerifiedLibrarian: false, isWikiEditor: false }
    const json = (await res.json()) as {
      data?: { isVerifiedLibrarian?: boolean; contributorRole?: string }[]
    }
    const profile = json.data?.[0]

    return {
      isVerifiedLibrarian: profile?.isVerifiedLibrarian ?? false,
      isWikiEditor: profile?.contributorRole === "wiki_editor",
    }
  } catch {
    return { isVerifiedLibrarian: false, isWikiEditor: false }
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

async function fetchClaimedLibraries(
  baUserId: string
): Promise<ClaimedLibrary[]> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return []
  try {
    const res = await fetch(
      `${STRAPI}/api/auth-bridge/user-affiliations?baUserId=${encodeURIComponent(baUserId)}`,
      { headers: { "X-Service-Secret": secret }, cache: "no-store" }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { libraries?: ClaimedLibrary[] }

    return json.libraries ?? []
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
    claimedLibraries,
  ] = await Promise.all([
    fetchLibraryCount(),
    session?.user
      ? fetchProfileRole(session.user.id)
      : Promise.resolve({ isVerifiedLibrarian: false, isWikiEditor: false }),
    session?.user
      ? fetchMySubmissionStats(session.user.id)
      : Promise.resolve(null),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user ? fetchQuickWins(session.user.id) : Promise.resolve([]),
    session?.user ? fetchFirstName(session.user.id) : Promise.resolve(""),
    session?.user
      ? fetchClaimedLibraries(session.user.id)
      : Promise.resolve([] as ClaimedLibrary[]),
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
      <ContributeNavBar />
      {!session?.user && (
        <div className="mx-auto w-full max-w-[1296px] px-6 py-10 md:px-10">
          <div
            style={{
              position: "relative",
              borderRadius: "20px",
              border: `1px solid rgba(127,223,255,0.18)`,
              background: `radial-gradient(ellipse 80% 120% at 10% 50%, rgba(127,223,255,0.07) 0%, transparent 60%), ${T.bg.deep}`,
              padding: "40px 48px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "32px",
              flexWrap: "wrap",
            }}
          >
            {/* Decorative bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "3px",
                background: `linear-gradient(to bottom, ${T.accent.aurora}, transparent)`,
                borderRadius: "20px 0 0 20px",
              }}
            />

            <div style={{ flex: 1, minWidth: "280px" }}>
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  opacity: 0.8,
                  margin: "0 0 12px",
                }}
              >
                Join the atlas
              </p>
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: T.ink.base,
                  margin: "0 0 12px",
                }}
              >
                Every library added starts{" "}
                <em style={{ fontStyle: "italic", color: T.ink.dim }}>
                  with an account.
                </em>
              </h2>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "14px",
                  color: T.ink.dim,
                  lineHeight: 1.65,
                  margin: 0,
                  maxWidth: "52ch",
                }}
              >
                Create a free account to submit corrections, add missing
                libraries, and earn your place on the contributor leaderboard.
                Your changes are reviewed by our editorial team before
                publishing.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flexShrink: 0,
              }}
            >
              <Link
                href="/auth/register"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "12px 28px",
                  borderRadius: "10px",
                  border: "1px solid rgba(127,223,255,0.35)",
                  background: "rgba(127,223,255,0.1)",
                  color: T.accent.aurora,
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Create free account →
              </Link>
              <Link
                href="/auth/signin"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontFamily: T.font.mono,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  textDecoration: "none",
                }}
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      )}

      {session?.user && standingWithName && (
        <div className="mx-auto w-full max-w-[1296px] px-6 py-8 md:px-10">
          <WelcomeBackWidget standing={standingWithName} />
        </div>
      )}
      {session?.user && quickWins.length > 0 && (
        <QuickWinsSection wins={quickWins} />
      )}
      {session?.user && claimedLibraries.length > 0 && (
        <div className="mx-auto w-full max-w-[1296px] px-6 pt-10 pb-2 md:px-10">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: T.ink.base,
              margin: "0 0 16px",
            }}
          >
            Your{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: T.accent.aurora,
              }}
            >
              libraries.
            </em>
          </h2>
        </div>
      )}
      {session?.user && claimedLibraries.length > 0 && (
        <div className="mx-auto w-full max-w-[1296px] px-6 pb-6 md:px-10">
          <div className="flex snap-x snap-mandatory gap-px overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
            {claimedLibraries.map((lib, index) => (
              <LibraryCard
                key={lib.entityRef ?? lib.documentId ?? index}
                documentId={lib.documentId ?? lib.slug ?? String(index)}
                slug={lib.slug}
                name={lib.name ?? ""}
                libraryType={lib.libraryType}
                heroImageUrl={formatStrapiMediaUrl(lib.heroImageUrl) ?? null}
                href={`/contribute/edit/${lib.slug ?? ""}`}
                index={index}
                variant="featured"
              />
            ))}
          </div>
        </div>
      )}
      <ContributePathCards
        isSignedIn={!!session?.user}
        isVerifiedLibrarian={roleData.isVerifiedLibrarian}
        isWikiEditor={roleData.isWikiEditor}
      />
      <ContributeGuidelinesSection />
      <ContributeCommunitySection />
    </div>
  )
}
