import type { Metadata } from "next"
import { headers } from "next/headers"
import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { computeCompleteness } from "@/components/library/library-page.helpers"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"
import { fetchHomepageContinents } from "@/lib/strapi-api/content/server"

import { HowReviewWorks } from "./_components/hub/HowReviewWorks"
import { HubActionChooser } from "./_components/hub/HubActionChooser"
import {
  RecordsThatNeedYou,
  type ContinentCount,
  type IncompleteRecord,
} from "./_components/hub/RecordsThatNeedYou"
import { RolesTable } from "./_components/hub/RolesTable"
import {
  SignInPromptCard,
  YourSubmissionsList,
  type HubSubmission,
} from "./_components/hub/YourSubmissionsList"

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
const GITHUB_REPO = "https://github.com/libraries-global/libraries.global"

const MISSING_LABELS: Record<string, string> = {
  hours: "Opening hours",
  collections: "Collections",
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

type LibraryEntry = {
  documentId: string
  slug?: string | null
  name?: string | null
  city?: string | null
  region?: { name?: string | null } | null
  country?: { name?: string | null } | null
  heroImage?: unknown
  [key: string]: unknown
}

async function fetchIncompleteRecords(): Promise<IncompleteRecord[]> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const params = new URLSearchParams({
      status: "published",
      "pagination[pageSize]": "100",
      "populate[heroImage][fields][0]": "url",
      "populate[accessibility][fields][0]": "name",
      "populate[services][fields][0]": "name",
      "populate[amenities][fields][0]": "name",
      "populate[country][fields][0]": "name",
      "populate[region][fields][0]": "name",
    })
    const res = await fetch(`${STRAPI}/api/libraries?${params}`, {
      next: { revalidate: 300 },
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LibraryEntry[] }

    const scored = (json.data ?? [])
      .filter((entry) => entry.slug && entry.name)
      .map((entry) => {
        const completeness = computeCompleteness(
          entry as Parameters<typeof computeCompleteness>[0]
        )
        const percent = Math.round(
          (completeness.filled / completeness.total) * 100
        )
        const missing = completeness.sections
          .filter((section) => !section.filled && MISSING_LABELS[section.key])
          .map((section) => MISSING_LABELS[section.key]!)

        return {
          documentId: entry.documentId,
          slug: entry.slug!,
          name: entry.name!,
          place: [entry.city, entry.region?.name, entry.country?.name]
            .filter(Boolean)
            .join(", "),
          percent,
          missing,
        }
      })
      .filter((record) => record.percent < 100 && record.missing.length > 0)
      .sort((a, b) => a.percent - b.percent)

    return scored.slice(0, 4)
  } catch {
    return []
  }
}

async function fetchMySubmissions(baUserId: string): Promise<HubSubmission[]> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return []
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": secret,
        "X-Ba-User-Id": baUserId,
        "X-Ba-User-Email": "",
      },
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        documentId: string
        submissionType?: string
        status?: string
        targetSlug?: string | null
        fields?: { name?: unknown } | null
        createdAt?: string
      }[]
    }

    return (json.data ?? [])
      .filter((item) => item.status && item.status !== "draft")
      .slice(0, 4)
      .map((item) => ({
        documentId: item.documentId,
        submissionType: item.submissionType ?? "correction",
        status: item.status!,
        targetName:
          typeof item.fields?.name === "string"
            ? item.fields.name
            : (item.targetSlug ?? null),
        createdAt: item.createdAt ?? new Date(0).toISOString(),
      }))
  } catch {
    return []
  }
}

async function fetchUsername(baUserId: string): Promise<string | null> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=username`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { username?: string }[] }

    return json.data?.[0]?.username ?? null
  } catch {
    return null
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
        className="flex items-center gap-1.5 text-[17px] font-semibold"
        style={{ color: T.ink.base }}
      >
        {title}
        <span aria-hidden="true">{external ? "↗" : "→"}</span>
      </span>
      <span
        className="mt-1.5 block text-[14.5px] leading-[1.55]"
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
  const { locale } = await params
  const session = await getSessionSSR(await headers())

  const [
    libraryCount,
    incompleteRecords,
    continentsResponse,
    submissions,
    username,
  ] = await Promise.all([
    fetchLibraryCount(),
    fetchIncompleteRecords(),
    fetchHomepageContinents(locale as Locale),
    session?.user
      ? fetchMySubmissions(session.user.id)
      : Promise.resolve([] as HubSubmission[]),
    session?.user ? fetchUsername(session.user.id) : Promise.resolve(null),
  ])

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
      <PageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Contribute" }]}
        eyebrow="Contribute"
        eyebrowIcon="mdi:account-group-outline"
        title="Help build the world’s *library index.*"
        lead="Add a missing library, fix a detail you know is wrong, or share a photo you took. Accuracy matters more than volume. A single well-sourced correction helps more than ten guesses."
      >
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          Community maintained, every change reviewed. New here? Read{" "}
          <GlobalLink
            href="/docs"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            How to Contribute
          </GlobalLink>{" "}
          (5 min).
        </p>
      </PageHero>

      {/* What would you like to do? */}
      <section className="mx-auto w-full max-w-[1360px] px-4 pt-12 sm:px-8">
        <h2
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(26px,3vw,32px)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          What would you like to do?
        </h2>
        <p className="mt-2 mb-6 text-[15px]" style={{ color: T.ink.dim }}>
          Choose one to start. You can save and come back later.
        </p>
        <HubActionChooser publishedCount={libraryCount} />
      </section>

      {incompleteRecords.length > 0 ? (
        <RecordsThatNeedYou
          records={incompleteRecords}
          continents={continents}
          totalPublished={libraryCount}
        />
      ) : null}

      <HowReviewWorks />
      <RolesTable />

      {session?.user ? (
        <YourSubmissionsList submissions={submissions} username={username} />
      ) : (
        <SignInPromptCard />
      )}

      {/* Bottom trio */}
      <section className="mx-auto w-full max-w-[1360px] px-4 pt-2 pb-14 sm:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BottomLinkCard
            title="Contribution guide"
            copy="What makes a good source, and how to write clear changes."
            href="/docs"
          />
          <BottomLinkCard
            title="Code of conduct"
            copy="How we treat each other in reviews and discussions."
            href={`${GITHUB_REPO}/blob/main/CODE_OF_CONDUCT.md`}
            external
          />
          <BottomLinkCard
            title="Contribute code"
            copy="The platform is open source. Issues and pull requests welcome."
            href={GITHUB_REPO}
            external
          />
        </div>
      </section>
    </div>
  )
}
