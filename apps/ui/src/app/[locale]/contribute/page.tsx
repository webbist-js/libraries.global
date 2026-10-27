import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { VoteOnAdditionsCard } from "@/components/community/VoteOnAdditionsCard"
import GlobalLink from "@/components/global/GlobalLink"
import {
  KNOWLEDGE_SLUGS,
  knowledgeHref,
} from "@/components/staff/knowledge-links"
import { sessionCapabilities, staffLibrariesOf } from "@/lib/access-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { KOFI_URL } from "@/lib/constants"
import { getContributionSession } from "@/lib/contribution-session-server"
import { T } from "@/lib/design-tokens"
import { followedRegionSlugs, type DriveView } from "@/lib/drives/drive-view"
import { drivesInPlaces, loadDriveViews } from "@/lib/drives/drive-view-server"
import { fetchDrives } from "@/lib/drives/drives-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"
import type { StaffOverview } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"
import {
  fetchHomepageContinents,
  fetchIncompleteLibraries,
} from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "./_components/ContributeSectionHeader"
import { ContributionJourney } from "./_components/hub/ContributionJourney"
import { DrivesYouCanHelpWith } from "./_components/hub/DrivesYouCanHelpWith"
import { HubActionChooser } from "./_components/hub/HubActionChooser"
import {
  RecordsThatNeedYou,
  type ContinentCount,
  type IncompleteRecord,
} from "./_components/hub/RecordsThatNeedYou"
import {
  SignInPromptCard,
  YourSubmissionsList,
  type HubSubmission,
} from "./_components/hub/YourSubmissionsList"
import { StaffContributeBanner } from "./_components/StaffContributeBanner"

// The hub is public and indexable; every other /contribute route inherits
// noindex from contribute/layout.tsx (forms, dashboards, auth-gated flows).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Contribute",
    description:
      "Add a missing library, fix a detail you know is wrong, or share a photo you took. Every change is reviewed and credited.",
    path: "contribute",
    locale,
  })
}

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const GITHUB_REPO = "https://github.com/webbist-js/libraries.global"

const MISSING_LABELS: Record<string, string> = {
  hours: "Opening hours",
  about: "Collections",
  facilities: "Accessibility",
  photo: "Photo",
}

async function fetchLibraryCount(): Promise<number> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/libraries?pagination[pageSize]=1&pagination[page]=1&status=published`,
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

async function fetchIncompleteRecords(): Promise<IncompleteRecord[]> {
  const records = await fetchIncompleteLibraries()

  return records
    .map(({ missing, ...record }) => ({
      ...record,
      missing: missing
        .filter((key) => MISSING_LABELS[key])
        .map((key) => MISSING_LABELS[key]!),
    }))
    .filter((record) => record.missing.length > 0)
    .slice(0, 4)
}

const MAX_HUB_DRIVES = 3

/**
 * The hub's drives (spec §9): pinned drives, featured first, or, with none
 * pinned, the first three open drives — places the reader follows first
 * (`followedIds`, null when signed out). At most three are ever counted.
 */
async function fetchHubDriveViews(
  locale: string,
  followedIds: Set<string> | null
): Promise<DriveView[]> {
  const drives = await fetchDrives("open", locale)
  const pinned = drives.filter((d) => d.pinned)
  const chosen =
    pinned.length > 0
      ? [...pinned].sort((a, b) => Number(b.featured) - Number(a.featured))
      : drives
  const ordered = followedIds
    ? [...chosen].sort(
        (a, b) =>
          Number(followedIds.has(b.documentId)) -
          Number(followedIds.has(a.documentId))
      )
    : chosen

  return loadDriveViews(ordered.slice(0, MAX_HUB_DRIVES), locale)
}

/** "loddon-library" → "Loddon library", for rows with nothing better. */
const humaniseSlug = (slug: string) => {
  const words = slug.replaceAll("-", " ").trim()

  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug
}

async function fetchMySubmissions(user: {
  id: string
  email: string
  name?: string | null
}): Promise<HubSubmission[]> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return []
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: bridgeUserHeaders(user),
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        documentId: string
        submissionType?: string
        status?: string
        targetSlug?: string | null
        fields?: Record<string, unknown> | null
        draftData?: Record<string, unknown> | null
        createdAt?: string
        drive?: { documentId: string; slug: string; title: string } | null
      }[]
    }
    const text = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : null

    return (json.data ?? [])
      .filter((item) => item.status && item.status !== "draft")
      .slice(0, 4)
      .map((item) => ({
        documentId: item.documentId,
        submissionType: item.submissionType ?? "correction",
        status: item.status!,
        // The library or article by name, not its slug.
        targetName:
          text(item.fields?.libraryName) ??
          text(item.fields?.name) ??
          text(item.draftData?.title) ??
          text(item.draftData?.proposedTitle) ??
          text(item.fields?.title) ??
          (item.targetSlug ? humaniseSlug(item.targetSlug) : null),
        createdAt: item.createdAt ?? new Date(0).toISOString(),
        drive: item.drive ?? null,
      }))
  } catch {
    return []
  }
}

function BottomLinkCard({
  title,
  copy,
  href,
  external,
}: {
  title: string
  copy: string
  href: string
  external?: boolean
}) {
  return (
    <GlobalLink
      href={href}
      className="group rounded-[18px] p-6 transition-colors hover:border-(--t-accent-primary)"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span
        className="flex items-center gap-1.5 text-base font-semibold"
        style={{ color: T.ink.base }}
      >
        {title}
        <span aria-hidden="true">{external ? "↗" : "→"}</span>
      </span>
      <span
        className="mt-1.5 block text-sm leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        {copy}
      </span>
    </GlobalLink>
  )
}

export default async function ContributePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale } = await params
  const session = await getContributionSession()
  // UI only; staff endpoints re-check the selected library's access.
  const caps = sessionCapabilities(session?.user)
  const staffLibraries = caps.set.has("staff.area")
    ? staffLibrariesOf(session?.user)
    : []
  const firstStaffLibrary = staffLibraries[0]

  const [
    libraryCount,
    incompleteRecords,
    continentsResponse,
    submissions,
    suggestions,
    profile,
    openDrives,
    howToContributeHref,
    staffOverview,
  ] = await Promise.all([
    fetchLibraryCount(),
    fetchIncompleteRecords(),
    fetchHomepageContinents(locale as Locale),
    session?.user
      ? fetchMySubmissions(session.user)
      : Promise.resolve([] as HubSubmission[]),
    fetchPublicSuggestions(),
    session?.user ? fetchOwnProfile(session.user) : Promise.resolve(null),
    fetchDrives("open", locale),
    // The "How to Contribute" article, when one is published under that slug.
    knowledgeHref(KNOWLEDGE_SLUGS.contribute, locale as Locale),
    session?.user && firstStaffLibrary
      ? fetchStaff<StaffOverview>(
          session.user,
          `libraries/${firstStaffLibrary.id}/overview`
        )
      : Promise.resolve(null),
  ])
  const followedIds = session?.user
    ? await drivesInPlaces(
        openDrives,
        followedRegionSlugs(profile?.followedLibraries),
        locale
      )
    : null
  const driveViews = await fetchHubDriveViews(locale, followedIds)
  // From the session (buildSessionAccess): `baUserId` is private, so the
  // public REST filter on it can't find the profile.
  const username = session?.user?.username ?? null
  const initialStaffMetrics =
    staffOverview?.status === 200 && staffOverview.body
      ? {
          suggestions: staffOverview.body.counts.suggestions,
          noticesActive: staffOverview.body.counts.noticesActive ?? null,
          completeness: staffOverview.body.library.completeness ?? null,
        }
      : null

  const continents: ContinentCount[] = (continentsResponse?.data ?? [])
    .map((continent) => ({
      name: continent.name ?? "",
      count: continent.libraryCount ?? 0,
    }))
    .filter((continent) => continent.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      {/* Hero band */}
      <ContributeSectionHeader
        title="Help build the world’s *library index.*"
        lead="Add a missing library, fix a detail you know is wrong, or share a photo you took. Accuracy matters more than volume. A single well-sourced correction helps more than ten guesses."
      >
        <p className="m-0 text-base" style={{ color: T.ink.dim }}>
          {staffLibraries.length > 0
            ? "Community maintained. Your staff tools are below."
            : "Community maintained, every change reviewed."}{" "}
          New here? Read{" "}
          <GlobalLink
            href={howToContributeHref ?? "/knowledge"}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            How to Contribute
          </GlobalLink>{" "}
          (5 min).
        </p>
      </ContributeSectionHeader>

      {/* What would you like to do? */}
      <section className="mx-auto w-full max-w-[1360px] px-4 pt-12 sm:px-8">
        {session?.user && staffLibraries.length > 0 ? (
          <StaffContributeBanner
            userId={session.user.id}
            libraries={staffLibraries.map(
              ({ id, slug, name, libraryType }) => ({
                id,
                slug,
                name,
                libraryType,
              })
            )}
            initialMetrics={initialStaffMetrics}
          />
        ) : null}
        <h2
          className="type-h2 m-0"
          style={{
            color: T.ink.base,
          }}
        >
          What would you like to do?
        </h2>
        <p className="mt-2 mb-6 text-base" style={{ color: T.ink.dim }}>
          Choose one to start. Drafts save on this device, so you can come back
          later.
        </p>
        <HubActionChooser
          publishedCount={libraryCount}
          suggestions={incompleteRecords}
        />
      </section>

      {driveViews.length > 0 ? (
        <DrivesYouCanHelpWith views={driveViews} />
      ) : incompleteRecords.length > 0 ? (
        <RecordsThatNeedYou
          records={incompleteRecords}
          continents={continents}
          totalPublished={libraryCount}
        />
      ) : null}

      <ContributionJourney
        signedIn={!!session?.user}
        hasClaim={caps.claimedLibraryIds.size > 0}
        isEditor={
          caps.set.has("docs.directEdit") || caps.set.has("journal.directEdit")
        }
        isModerator={caps.set.has("moderate.queue")}
      />

      {/* You: your submissions (3/4) beside voting on new additions (1/4). */}
      <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-6 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        {session?.user ? (
          <YourSubmissionsList submissions={submissions} username={username} />
        ) : (
          <SignInPromptCard />
        )}
        <div className="self-start">
          <VoteOnAdditionsCard
            initial={suggestions}
            signInReturnTo="/contribute#vote-on-additions"
          />
        </div>
      </div>

      {/* Bottom links */}
      <section className="mx-auto w-full max-w-[1360px] px-4 pt-2 pb-14 sm:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <BottomLinkCard
            title={tUi("contribution_guide")}
            copy="What makes a good source, and how to write clear changes."
            href="/knowledge"
          />
          <BottomLinkCard
            title={tUi("code_of_conduct")}
            copy="How we treat each other in reviews and discussions."
            href={`${GITHUB_REPO}/blob/main/CODE_OF_CONDUCT.md`}
            external
          />
          <BottomLinkCard
            title={tUi("contribute_code")}
            copy="The platform is open source. Issues and pull requests welcome."
            href={GITHUB_REPO}
            external
          />
          <BottomLinkCard
            title={tUi("support_the_project")}
            copy="No time to edit? A coffee on Ko-fi helps keep the index online and open."
            href={KOFI_URL}
            external
          />
        </div>
      </section>
    </div>
  )
}
