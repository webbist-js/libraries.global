"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { ContributionList } from "@/components/contributions/ContributionList"
import { StatCard } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { CARD, SectionTitle, TextLink } from "../ProfileSectionUI"

// Estimated points per type/status (mirrors rewards plugin)
function estimatePoints(s: PublicSubmission): number | null {
  if (s.status !== "approved") return null
  switch (s.submissionType) {
    case "new_library":
      return 50
    case "library_edit":
      return 10
    case "wiki_edit":
      return 5
    case "library_claim":
      return 5
    case "drive_proposal":
      return 10

    default:
      return null
  }
}

// ── Filters ───────────────────────────────────────────────────────────────

const FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "added", label: "Added", types: ["new_library"] },
  { id: "edited", label: "Edited", types: ["library_edit", "correction"] },
  {
    id: "articles",
    label: "Articles",
    types: ["wiki_edit", "blog_submission"],
  },
  { id: "claimed", label: "Claimed", types: ["library_claim"] },
  { id: "drives", label: "Drive proposals", types: ["drive_proposal"] },
  { id: "other", label: "Other", types: null },
] as const

type FilterId = (typeof FILTERS)[number]["id"]

const NAMED_TYPES: ReadonlySet<string> = new Set(
  FILTERS.flatMap((f) => f.types ?? [])
)

function matchesFilter(s: PublicSubmission, filter: FilterId): boolean {
  if (filter === "all") return true
  if (filter === "other") return !NAMED_TYPES.has(s.submissionType)
  const types: readonly string[] =
    FILTERS.find((f) => f.id === filter)?.types ?? []

  return types.includes(s.submissionType)
}

/**
 * A profile's public record: accepted contributions only, so a change in
 * review or not accepted never shows here. Its owner is pointed to My
 * submissions for those.
 */
export function ContributionsSection({
  username,
  isOwner = false,
}: {
  username: string
  isOwner?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const [submissions, setSubmissions] = useState<PublicSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}/contributions`)
      .then((r) => r.json())
      .then((json: { data?: PublicSubmission[] }) => {
        setSubmissions(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [
          f.id,
          submissions.filter((s) => matchesFilter(s, f.id)).length,
        ])
      ) as Record<FilterId, number>,
    [submissions]
  )
  const totalPts = submissions
    .map(estimatePoints)
    .filter((p): p is number => p !== null)
    .reduce((a, b) => a + b, 0)

  const ownerNote = isOwner ? (
    <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
      Only accepted changes appear here. Drafts and changes in review are in{" "}
      <TextLink href="/contribute/submissions">
        {tUi("my_submissions")}
      </TextLink>
      .
    </p>
  ) : null

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label={tUi("loading_contributions")}
        style={{ ...CARD, overflow: "hidden" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 px-6 py-4"
            style={{
              borderTop: i ? `1px solid ${T.border.divider}` : undefined,
            }}
          >
            <div
              className="size-11 shrink-0 rounded-[14px]"
              style={{ background: T.bg.muted }}
            />
            <div className="flex-1">
              <div
                className="mb-2 h-3 w-3/5 rounded"
                style={{ background: T.bg.muted }}
              />
              <div
                className="h-2.5 w-2/5 rounded"
                style={{ background: T.bg.muted }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <section aria-labelledby="ct-empty" style={{ ...CARD, padding: "24px" }}>
        <SectionTitle as="h2" id="ct-empty">
          Contributions
        </SectionTitle>
        <p className="m-0 mt-2 text-[15px]" style={{ color: T.ink.dim }}>
          No accepted contributions yet. Added libraries, edits and articles
          appear here once a moderator accepts them.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {ownerNote}
          <p className="m-0">
            <TextLink href="/contribute">Start contributing</TextLink>
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <h2 className="sr-only">Contribution summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={tUi("accepted")}
          value={String(submissions.length)}
          bg="var(--tint-public-bg)"
          fg="var(--tint-public-fg)"
          icon="mdi:check-circle-outline"
        />
        <StatCard
          label={tUi("libraries_added")}
          value={String(counts.added)}
          bg="var(--tint-neutral-bg)"
          fg="var(--tint-neutral-fg)"
          icon="mdi:book-plus-outline"
        />
        <StatCard
          label={tUi("records_improved")}
          value={String(counts.edited)}
          bg="var(--tint-academic-bg)"
          fg="var(--tint-academic-fg)"
          icon="mdi:pencil-outline"
        />
        <StatCard
          label={tUi("points_earned")}
          value={totalPts.toLocaleString()}
          bg="var(--tint-national-bg)"
          fg="var(--tint-national-fg)"
          icon="mdi:star-four-points-outline"
        />
      </div>

      <ContributionList
        title={tUi("accepted_contributions")}
        items={submissions}
        filters={FILTERS}
        matches={matchesFilter}
        legend="Filter by type"
        rowExtras={(sub) => ({ points: estimatePoints(sub) })}
        intro={ownerNote}
      />
    </div>
  )
}
