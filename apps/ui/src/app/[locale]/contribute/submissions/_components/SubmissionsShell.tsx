"use client"

import { Icon } from "@iconify/react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect } from "react"

import { ContributionList } from "@/components/contributions/ContributionList"
import { docsPathForSearchHit } from "@/components/docs/docs.config"
import { StatCard } from "@/components/ds"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { useCapabilities, useHydratedSession } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { isArticleEditor } from "@/lib/editor-gate"
import {
  buildLibraryPath,
  searchBlogArticles,
  searchLibraryNames,
  searchWikiArticles,
} from "@/lib/meilisearch"
import { Link, usePathname, useRouter } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"

import { DiscussionWork } from "./DiscussionWork"
import { continueLink } from "./submissionContinue"
import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending", label: "In review" },
  { id: "needs_info", label: "Changes requested" },
  { id: "approved", label: "Accepted" },
  { id: "rejected", label: "Not accepted" },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"]

const matchesStatus = (s: Submission, filter: StatusFilter) =>
  filter === "all" || s.status === filter

// ── "View" links ─────────────────────────────────────────────────────────────
// A sent submission links to what it's about: the library's page or the
// article. Strapi gives the rows a target id or slug, not a path, so the
// paths come from Meilisearch: libraries in one `documentId IN` query, and
// articles by title, matched back on slug (slug isn't filterable there).

/**
 * Submission types whose target is a library the row can link to (the
 * hook's union lags Strapi's, so these are plain strings).
 */
const LIBRARY_TARGET_TYPES = new Set<string>([
  "library_edit",
  "correction",
  "library_claim",
  "event_feed",
])

/** Statuses that get a "View" link: in review and accepted. */
const VIEWABLE_STATUSES = new Set<Submission["status"]>(["pending", "approved"])

/** A new library has no target; its id arrives in `resultDocumentId` once created. */
type WithResult = Submission & { resultDocumentId?: string | null }

const MAX_LIBRARY_LOOKUPS = 50
const MAX_ARTICLE_LOOKUPS = 10

/** The library a viewable row links to, by documentId, or null. */
function libraryIdOf(s: Submission): string | null {
  if (LIBRARY_TARGET_TYPES.has(s.submissionType))
    return s.targetDocumentId ?? null
  if (s.submissionType === "new_library" && s.status === "approved")
    return (s as WithResult).resultDocumentId ?? null

  return null
}

const isArticle = (s: Submission) =>
  (s.submissionType === "wiki_edit" ||
    s.submissionType === "blog_submission") &&
  Boolean(s.targetSlug)

async function libraryPaths(
  ids: readonly string[],
  locale: string
): Promise<Map<string, string>> {
  const paths = new Map<string, string>()
  if (ids.length === 0) return paths
  try {
    const { hits } = await searchLibraryNames("", {
      hitsPerPage: ids.length,
      attributesToRetrieve: [
        "documentId",
        "slug",
        "continent_slug",
        "country_slug",
        "region_slug",
      ],
      filters: [
        `documentId IN [${ids.map((id) => JSON.stringify(id)).join(", ")}]`,
      ],
      locale,
    })
    for (const hit of hits) {
      const path = buildLibraryPath(hit)
      if (path) paths.set(hit.documentId, path)
    }
  } catch {
    // Meilisearch down: the rows simply have no "View" link.
  }

  return paths
}

async function articlePath(
  s: Submission,
  locale: string
): Promise<string | null> {
  const slug = s.targetSlug!
  const query = s.targetLabel?.trim() || slug
  try {
    if (s.submissionType === "wiki_edit") {
      const { hits } = await searchWikiArticles(query, null, 5, locale)
      const hit = hits.find((h) => h.slug === slug)

      return hit ? docsPathForSearchHit(hit) : null
    }
    const { hits } = await searchBlogArticles(query, 5, locale)
    const hit = hits.find((h) => h.slug === slug)

    return hit ? `/journal/${hit.section_slug ?? "general"}/${hit.slug}` : null
  } catch {
    return null
  }
}

/** Submission documentId → the page it's about, for the rows that have one. */
async function resolveTargetHrefs(
  submissions: readonly Submission[],
  locale: string
): Promise<Record<string, string>> {
  const rows = submissions.filter((s) => VIEWABLE_STATUSES.has(s.status))
  const ids = [
    ...new Set(rows.map(libraryIdOf).filter((id): id is string => !!id)),
  ].slice(0, MAX_LIBRARY_LOOKUPS)
  const articles = rows.filter(isArticle).slice(0, MAX_ARTICLE_LOOKUPS)
  const [libraries, articleHrefs] = await Promise.all([
    libraryPaths(ids, locale),
    Promise.all(articles.map((s) => articlePath(s, locale))),
  ])

  const hrefs: Record<string, string> = {}
  for (const s of rows) {
    const id = libraryIdOf(s)
    const path = id ? libraries.get(id) : undefined
    if (path) hrefs[s.documentId] = path
  }
  articles.forEach((s, i) => {
    const href = articleHrefs[i]
    if (href) hrefs[s.documentId] = href
  })

  return hrefs
}

function useTargetHrefs(submissions: readonly Submission[]) {
  const locale = useLocale()
  const actor = useHydratedSession()
  const owner =
    !actor.isPending && !actor.error ? actor.data?.user?.id : undefined
  const key = submissions
    .filter((s) => VIEWABLE_STATUSES.has(s.status))
    .map((s) => s.documentId)
    .sort((a, b) => a.localeCompare(b))
    .join(",")
  const { data } = useQuery({
    queryKey: ["submission-target-hrefs", owner ?? null, locale, key],
    queryFn: () => resolveTargetHrefs(submissions, locale),
    enabled: Boolean(owner) && key.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  return owner ? (data ?? {}) : {}
}

function ViewLink({
  href,
  kind,
}: {
  href: string
  kind: "library" | "article"
}) {
  const tUi = useUiTranslations("ui")

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border bg-white px-4 py-1.5 text-[14px] font-semibold whitespace-nowrap no-underline transition-colors hover:bg-(--t-bg-surface)"
      style={{ borderColor: T.border.hi, color: T.ink.base }}
    >
      {tUi("view")} {kind}
      <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
    </Link>
  )
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse rounded-[20px]"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * My submissions: everything the user has sent or started, in the same
 * rows as the Contributions tab on their profile, with a Continue link on
 * drafts and the moderator's note on a decision.
 */
export function SubmissionsShell({ username }: { username: string | null }) {
  const tUi = useUiTranslations("ui")
  const p = useUiTranslations("publishing")
  const query = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const tab = query.get("tab") === "discussions" ? "discussions" : "articles"
  const setTab = (next: "articles" | "discussions") => {
    const params = new URLSearchParams(query.toString())
    if (next === "discussions") params.set("tab", next)
    else params.delete("tab")
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    })
  }

  const { data: submissions = [], isLoading, refetch } = useMySubmissions()
  const { has, ready } = useCapabilities()
  const targetHrefs = useTargetHrefs(submissions)

  useEffect(() => {
    refetch()
    const id = setInterval(() => refetch(), 60000)

    return () => clearInterval(id)
  }, [refetch])

  const count = (status: Submission["status"]) =>
    submissions.filter((s) => s.status === status).length

  const rowExtras = (s: Submission) => {
    if (s.status === "draft" || s.status === "needs_info") {
      const next = continueLink(
        s,
        (kind) => !ready || isArticleEditor(has, kind)
      )

      return {
        ...(s.status === "needs_info" && s.reviewNote
          ? { note: { text: s.reviewNote, tone: "warn" as const } }
          : {}),
        action: (
          <Link
            href={next.href}
            className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[14px] font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            {s.status === "needs_info"
              ? tUi("revise_and_resubmit")
              : next.label}
            <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
          </Link>
        ),
      }
    }
    if (
      s.status === "pending" &&
      (s.submissionType === "wiki_edit" ||
        s.submissionType === "blog_submission")
    ) {
      const next = continueLink({ ...s, status: "draft" }, () => true)

      return {
        action: (
          <Link
            href={next.href}
            className="rounded-full border px-4 py-2 underline"
          >
            {p("withdraw")}
          </Link>
        ),
      }
    }
    if (s.status === "rejected" && s.reviewNote)
      return {
        note: {
          text: s.reviewNote,
          tone: "danger" as const,
        },
      }
    const href = targetHrefs[s.documentId]
    // An approved claim opened a Staff area: that beats the public page.
    if (
      s.submissionType === "library_claim" &&
      s.status === "approved" &&
      s.targetDocumentId
    )
      return {
        action: (
          <Link
            href={staffLibraryHref(s.targetSlug)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            Open Staff area
            <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
          </Link>
        ),
      }
    if (href)
      return {
        action: (
          <ViewLink href={href} kind={isArticle(s) ? "article" : "library"} />
        ),
      }

    return {}
  }

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <ContributeSectionHeader
        section={tUi("my_submissions")}
        title="Your contributions, *in flight.*"
        lead="Drafts, changes in review and decisions, with the moderator’s note where there is one."
      >
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          This list refreshes every minute.
        </p>
      </ContributeSectionHeader>

      <Tabs
        value={tab}
        onValueChange={(next) =>
          setTab(next === "discussions" ? "discussions" : "articles")
        }
        className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8"
      >
        <TabsList
          aria-label={p("yourWork")}
          className="mb-5 h-auto flex-wrap gap-2 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          <TabsTrigger
            value="articles"
            className="min-h-11 rounded-full border px-4 py-2 font-semibold"
          >
            {p("articleWork")}
          </TabsTrigger>
          <TabsTrigger
            value="discussions"
            className="min-h-11 rounded-full border px-4 py-2 font-semibold"
          >
            {p("discussionWork")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="discussions">
          <DiscussionWork />
        </TabsContent>
        <TabsContent value="articles">
          {isLoading ? (
            <SkeletonList />
          ) : submissions.length === 0 ? (
            <section
              aria-labelledby="subs-empty"
              className="rounded-[20px] p-6"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
              }}
            >
              <h2
                id="subs-empty"
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "24px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: T.ink.base,
                }}
              >
                No submissions yet
              </h2>
              <p
                className="mt-2 mb-3 text-[15px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                Libraries you add, corrections and articles appear here as soon
                as you start them.
              </p>
              <Link
                href="/contribute"
                className="text-[15px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Start contributing
              </Link>
            </section>
          ) : (
            <div className="flex flex-col gap-6">
              <h2 className="sr-only">{tUi("submission_summary")}</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label={tUi("drafts")}
                  value={String(count("draft"))}
                  bg="var(--tint-neutral-bg)"
                  fg="var(--tint-neutral-fg)"
                  icon="mdi:file-document-edit-outline"
                />
                <StatCard
                  label={tUi("in_review")}
                  value={String(count("pending"))}
                  bg="var(--tint-academic-bg)"
                  fg="var(--tint-academic-fg)"
                  icon="mdi:clock-outline"
                />
                <StatCard
                  label={tUi("changes_requested")}
                  value={String(count("needs_info"))}
                  bg="#F5EEDC"
                  fg="#6B5420"
                  icon="mdi:alert-circle-outline"
                />
                <StatCard
                  label={tUi("accepted")}
                  value={String(count("approved"))}
                  bg="var(--tint-public-bg)"
                  fg="var(--tint-public-fg)"
                  icon="mdi:check-circle-outline"
                />
              </div>

              <ContributionList
                title={tUi("your_submissions")}
                items={submissions}
                filters={STATUS_FILTERS}
                matches={matchesStatus}
                legend="Filter by status"
                rowExtras={rowExtras}
                intro={
                  username ? (
                    <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                      Accepted ones also make up the public record on{" "}
                      <Link
                        href={`/profile/${encodeURIComponent(username)}/contributions`}
                        className="font-semibold underline underline-offset-[3px]"
                        style={{ color: T.accent.primary }}
                      >
                        your profile
                      </Link>
                      .
                    </p>
                  ) : null
                }
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
