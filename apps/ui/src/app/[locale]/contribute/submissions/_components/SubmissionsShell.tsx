"use client"

import { Icon } from "@iconify/react"
import { useEffect } from "react"

import { ContributionList } from "@/components/contributions/ContributionList"
import { StatCard } from "@/components/ds"
import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { editorApplyHref, isArticleEditor } from "@/lib/editor-gate"
import { Link } from "@/lib/navigation"

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

/** Where an unsent draft continues: the record wizard or the article editor. */
function continueHref(submission: Submission): string {
  const { submissionType, targetSlug, documentId, draftData } = submission
  if (submissionType === "wiki_edit" || submissionType === "blog_submission") {
    const kind = submissionType === "wiki_edit" ? "knowledge" : "journal"
    if (
      (draftData as { kind?: unknown } | null)?.kind === "new_article" ||
      !targetSlug
    )
      return `/contribute/knowledge/new?type=${kind}&draft=${encodeURIComponent(documentId)}`

    return kind === "knowledge"
      ? `/contribute/knowledge/${encodeURIComponent(targetSlug)}`
      : `/contribute/knowledge/journal/${encodeURIComponent(targetSlug)}`
  }
  if (
    (submissionType === "library_edit" || submissionType === "correction") &&
    targetSlug
  )
    return `/contribute/index/${encodeURIComponent(targetSlug)}`

  return "/contribute/index/new"
}

/**
 * A draft's next step. The article editor is for editors, so anyone else
 * is sent to the editor role application.
 */
function continueLink(
  submission: Submission,
  isEditor: (kind: "knowledge" | "journal") => boolean
): { href: string; label: string } {
  const href = continueHref(submission)
  const { submissionType } = submission
  if (submissionType !== "wiki_edit" && submissionType !== "blog_submission")
    return { href, label: "Continue" }
  const kind = submissionType === "wiki_edit" ? "knowledge" : "journal"

  return isEditor(kind)
    ? { href, label: "Continue" }
    : { href: editorApplyHref(kind), label: "Apply to edit" }
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
  const { data: submissions = [], isLoading, refetch } = useMySubmissions()
  const { has, ready } = useCapabilities()

  useEffect(() => {
    refetch()
    const id = setInterval(() => refetch(), 60000)

    return () => clearInterval(id)
  }, [refetch])

  const count = (status: Submission["status"]) =>
    submissions.filter((s) => s.status === status).length

  const rowExtras = (s: Submission) => {
    if (s.status === "draft") {
      const next = continueLink(
        s,
        (kind) => !ready || isArticleEditor(has, kind)
      )

      return {
        action: (
          <Link
            href={next.href}
            className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[14px] font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            {next.label}
            <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
          </Link>
        ),
      }
    }
    if ((s.status === "needs_info" || s.status === "rejected") && s.reviewNote)
      return {
        note: {
          text: s.reviewNote,
          tone:
            s.status === "needs_info" ? ("warn" as const) : ("danger" as const),
        },
      }

    return {}
  }

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <ContributeSectionHeader
        section="My submissions"
        title="Your contributions, *in flight.*"
        lead="Drafts, changes in review and decisions, with the moderator’s note where there is one."
      >
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          This list refreshes every minute.
        </p>
      </ContributeSectionHeader>

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
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
              Libraries you add, corrections and articles appear here as soon as
              you start them.
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
            <h2 className="sr-only">Submission summary</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Drafts"
                value={String(count("draft"))}
                bg="var(--tint-neutral-bg)"
                fg="var(--tint-neutral-fg)"
                icon="mdi:file-document-edit-outline"
              />
              <StatCard
                label="In review"
                value={String(count("pending"))}
                bg="var(--tint-academic-bg)"
                fg="var(--tint-academic-fg)"
                icon="mdi:clock-outline"
              />
              <StatCard
                label="Changes requested"
                value={String(count("needs_info"))}
                bg="#F5EEDC"
                fg="#6B5420"
                icon="mdi:alert-circle-outline"
              />
              <StatCard
                label="Accepted"
                value={String(count("approved"))}
                bg="var(--tint-public-bg)"
                fg="var(--tint-public-fg)"
                icon="mdi:check-circle-outline"
              />
            </div>

            <ContributionList
              title="Your submissions"
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
      </div>
    </>
  )
}
