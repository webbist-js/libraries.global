import { Icon } from "@iconify/react"
import { reviewCategoryOf } from "@repo/access"
import { isStaleTimetableSuggestion } from "@repo/shared-data"
import { notFound } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { BackLink } from "@/components/ds/BackLink"
import {
  ArticleReviewPanel,
  ClaimPanel,
  detailOf,
  DriveChip,
  DriveProposalPanel,
  EventFeedPanel,
  type EventFeedReview,
  EVIDENCE_TYPE_LABELS,
  FacilitiesPanel,
  FieldsList,
  formatDateTime,
  KeyValueList,
  type ModerationDetail,
  moderationRowLabel,
  NewLibraryPanel,
  RecordChangesTable,
  ReviewDecisionForm,
  type ReviewEvent,
  ReviewThread,
  RoleApplicationPanel,
  StatusBadge,
  VerificationPanel,
} from "@/components/moderation"
import { NetworkClaimReview } from "@/components/moderation/NetworkClaimReview"
import { reviewReturnHref } from "@/components/moderation/queue-navigation"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { userIsArticleEditor } from "@/lib/editor-gate"
import { fetchModeration } from "@/lib/moderation-proxy"
import { Link } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { fetchPlaceLink, type PlaceLink } from "@/lib/strapi-api/content/server"

import { ModerationAccessUnavailable } from "../_components/ModerationAccessUnavailable"
import { ModerationHero } from "../_components/ModerationHero"
import { requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Review a submission")

/** A white section card with a heading. */
function Section({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-[24px] p-5 sm:p-6"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <h2 className="type-h2 m-0" style={{ color: T.ink.base }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

const isArticle = (t: string) => t === "wiki_edit" || t === "blog_submission"

/** What a panel needs beyond the detail, read on the server. */
type PanelContext = {
  /** Locale code → name. */
  localeNames: Record<string, string>
}

/** The record an approval created: what it is and where to open it. */
async function createdRecord(
  d: ModerationDetail
): Promise<{ label: string; link: PlaceLink | null } | null> {
  if (!d.resultDocumentId || d.submissionType !== "new_library") return null
  const link = await fetchPlaceLink(d.resultDocumentId)
  const label = link?.href?.startsWith("/contribute/")
    ? "Open the new library in the Index editor"
    : "Open the new library"

  return { label, link }
}

/**
 * The review panel for each submission type; anything unlisted shows its
 * fields.
 */
const PANELS: Record<
  string,
  (d: ModerationDetail, ctx: PanelContext) => ReactNode
> = {
  network_claim: (d) => (
    <p>
      A grouped {String(d.fields?.intent ?? "service")} request. Review its
      frozen scope in the decision panel.
    </p>
  ),
  library_claim: (d) => (
    <ClaimPanel
      fields={d.fields}
      targetSlug={d.targetSlug}
      libraryDocumentId={d.targetDocumentId}
      review={d.review}
    />
  ),
  wiki_edit: (d) => <ArticleReviewPanel detail={d} />,
  blog_submission: (d) => <ArticleReviewPanel detail={d} />,
  new_library: (d) => (
    <NewLibraryPanel
      documentId={d.documentId}
      status={d.status}
      fields={d.fields}
      draftData={d.draftData}
    />
  ),
  role_application: (d, ctx) => (
    <RoleApplicationPanel
      fields={d.fields}
      applicant={d.applicant}
      localeNames={ctx.localeNames}
    />
  ),
  library_edit: (d) => (
    <RecordChangesTable
      submissionType={d.submissionType}
      fields={d.fields}
      review={d.review}
    />
  ),
  event_feed: (d) => (
    <EventFeedPanel
      documentId={d.documentId}
      status={d.status}
      review={d.review as EventFeedReview | null}
    />
  ),
  drive_proposal: (d) => (
    <DriveProposalPanel
      documentId={d.documentId}
      status={d.status}
      proposal={d.proposal ?? null}
      applicant={d.applicant ?? null}
    />
  ),
  correction: (d) => {
    if (d.fields?.kind === "verify")
      return (
        <VerificationPanel
          fields={d.fields}
          review={d.review}
          status={d.status}
          evidenceType={d.evidenceType}
          evidenceUrl={d.evidenceUrl}
        />
      )
    if (d.fields?.kind === "record")
      return (
        <RecordChangesTable
          submissionType={d.submissionType}
          fields={d.fields}
          review={d.review}
        />
      )
    if (d.fields?.kind === "facilities")
      return <FacilitiesPanel fields={d.fields} />

    return <FieldsList fields={d.fields} />
  },
}

const PANEL_TITLES: Record<string, string> = {
  library_claim: "The claim",
  wiki_edit: "The article",
  blog_submission: "The article",
  new_library: "The new library",
  role_application: "The application",
  event_feed: "The event feed",
  drive_proposal: "The proposed drive",
}

/**
 * Where the Moderator can open what the submission changes. The article
 * editors only open for Moderators who also hold that editor role.
 */
function targetLinks(
  d: ModerationDetail,
  user: { capabilities?: unknown }
): { href: string; label: string }[] {
  const slug = d.targetSlug
  if (!slug) return []
  const isNewArticle =
    d.draftData?.kind === "new_article" || d.fields?.kind === "new_article"
  if (d.submissionType === "wiki_edit")
    return isNewArticle || !userIsArticleEditor(user, "knowledge")
      ? []
      : [
          {
            href: `/contribute/knowledge/${encodeURIComponent(slug)}`,
            label: "Open the article in the Knowledge editor",
          },
        ]
  if (d.submissionType === "blog_submission")
    return isNewArticle || !userIsArticleEditor(user, "journal")
      ? []
      : [
          {
            href: `/contribute/knowledge/journal/${encodeURIComponent(slug)}`,
            label: "Open the article in the Journal editor",
          },
        ]
  if (
    ["correction", "library_edit", "library_claim", "event_feed"].includes(
      d.submissionType
    )
  )
    return [
      {
        href: `/contribute/index/${encodeURIComponent(slug)}`,
        label: "Open the record in the Index editor",
      },
    ]

  return []
}

function LoadFailed() {
  return (
    <>
      <ModerationHero title="Review a *submission*" leaf="Review" />
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
        <p
          role="alert"
          className="m-0 rounded-[14px] px-4 py-3 text-base"
          style={{ background: "#F6E3DA", color: T.accent.danger }}
        >
          This submission could not be loaded. Try again in a moment.
        </p>
      </div>
    </>
  )
}

export default async function ReviewSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; documentId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const tUi = await getUiTranslations("ui")

  const { documentId } = await params
  const search = await (searchParams ?? Promise.resolve({}))
  const requestedReturn = reviewReturnHref(
    "returnTo" in search ? search.returnTo : undefined
  )
  const { user, accessUnknown } = await requireModerator(
    `/contribute/moderation/${encodeURIComponent(documentId)}${requestedReturn ? `?returnTo=${encodeURIComponent(requestedReturn)}` : ""}`
  )
  if (!isDocumentIdParam(documentId)) notFound()
  // The bridge didn't answer: the viewer may well moderate, and the
  // submission may well exist. Never a 404 for that.
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable
        title="Review a *submission*"
        leaf="Review"
        path={`/contribute/moderation/${documentId}`}
      />
    )

  const [detailRes, eventsRes, locales] = await Promise.all([
    fetchModeration<{ data?: ModerationDetail }>(
      user,
      `submissions/${documentId}`
    ),
    fetchModeration<{ data?: ReviewEvent[] }>(
      user,
      `submissions/${documentId}/events`
    ),
    fetchArticleLocales(),
  ])
  // Missing, a draft, out of scope or the viewer's own: all look the same.
  if (detailRes.status === 404 || detailRes.status === 403) notFound()
  const d = detailRes.body?.data
  if (detailRes.status !== 200 || !d) return <LoadFailed />
  const events = eventsRes.body?.data ?? []
  const category = reviewCategoryOf(d.submissionType)
  const returnTo =
    requestedReturn ??
    (category
      ? `/contribute/moderation?category=${category}`
      : "/contribute/moderation")
  const created = await createdRecord(d)
  const panelContext: PanelContext = {
    localeNames: Object.fromEntries(locales.map((l) => [l.code, l.name])),
  }
  const language =
    locales.find((l) => l.code === d.locale)?.name ?? d.locale.toUpperCase()
  const panel = (
    PANELS[d.submissionType] ??
    ((x: ModerationDetail) => <FieldsList fields={x.fields} />)
  )(d, panelContext)
  const contributorNote = !isArticle(d.submissionType)
    ? [d.editSummary, d.note].filter(Boolean).join(" — ")
    : (d.note ?? "")
  const links = targetLinks(d, user)

  return (
    <>
      <ModerationHero title={d.summary} plainTitle leaf={moderationRowLabel(d)}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={d.status} />
          <span className="text-base" style={{ color: T.ink.dim }}>
            {`${moderationRowLabel(d)} · ${language}`}
          </span>
          {d.drive ? <DriveChip drive={d.drive} /> : null}
        </div>
      </ModerationHero>

      <div className="mx-auto grid w-full max-w-[1360px] gap-8 px-4 pt-8 pb-16 text-base [--spacing:0.25rem] sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="lg:col-span-2">
          <BackLink href={returnTo}>Back to the queue</BackLink>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Section title={tUi("about_this_submission")}>
            <KeyValueList
              rows={[
                { label: tUi("type"), value: moderationRowLabel(d) },
                { label: "Change", value: detailOf(d) ?? "" },
                {
                  label: "Contributor",
                  value: d.submittedByName ?? "Anonymous",
                },
                { label: "Submitted", value: formatDateTime(d.createdAt) },
                { label: tUi("language"), value: language },
                { label: "Record", value: d.targetSlug ?? "" },
                {
                  label: "Reviewed",
                  value: d.reviewedAt ? formatDateTime(d.reviewedAt) : "",
                },
                {
                  label: "Evidence",
                  value: d.evidenceType
                    ? (EVIDENCE_TYPE_LABELS[d.evidenceType] ?? d.evidenceType)
                    : "",
                },
                { label: "Evidence link", value: d.evidenceUrl ?? "" },
              ].filter((r) => r.value)}
            />
          </Section>

          {contributorNote ? (
            <Section title={tUi("the_contributors_note")}>
              <p
                className="m-0 text-base leading-[1.6] whitespace-pre-wrap"
                style={{ color: T.ink.base }}
              >
                {contributorNote}
              </p>
            </Section>
          ) : null}

          <Section
            title={
              d.fields?.kind === "verify"
                ? "Still right?"
                : (PANEL_TITLES[d.submissionType] ?? "Proposed changes")
            }
          >
            {panel}
          </Section>
        </div>

        <aside
          aria-label={tUi("decision")}
          className="flex flex-col gap-6 self-start lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
        >
          <Section title={tUi("your_decision")}>
            {d.submissionType === "network_claim" ? (
              <NetworkClaimReview documentId={d.documentId} status={d.status} />
            ) : (
              <ReviewDecisionForm
                canApprove={
                  !isStaleTimetableSuggestion(
                    d.submissionType,
                    d.fields,
                    (
                      d.review as {
                        current?: Record<string, unknown>
                      } | null
                    )?.current?.mobileTimetable
                  )
                }
                documentId={d.documentId}
                status={d.status}
                submissionType={d.submissionType}
                canPublish={d.canPublish}
                reviewedAt={d.reviewedAt}
                driveDocumentId={d.drive?.documentId ?? null}
                returnTo={returnTo}
              />
            )}
          </Section>
          <Section title={tUi("history")}>
            {d.reviewNote && events.every((e) => !e.note) ? (
              <p className="m-0 text-base" style={{ color: T.ink.base }}>
                <strong>Moderator note: </strong>
                {d.reviewNote}
              </p>
            ) : null}
            <ReviewThread events={events} />
          </Section>
          <nav
            aria-label={tUi("related_pages")}
            className="flex flex-col text-base"
          >
            {created?.link?.href ? (
              <Link
                href={created.link.href}
                className="flex min-h-12 items-center gap-2 border-t border-(--t-border-line) py-3 font-semibold underline underline-offset-4 hover:text-(--t-accent-primary-hover)"
                style={{ color: T.accent.primary }}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:open-in-new"
                  width={16}
                  height={16}
                />
                {created.label}
              </Link>
            ) : created ? (
              <p className="m-0" style={{ color: T.ink.dim }}>
                Approval created a new library record.
              </p>
            ) : null}
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex min-h-12 items-center gap-2 border-t border-(--t-border-line) py-3 font-semibold underline underline-offset-4 hover:text-(--t-accent-primary-hover)"
                style={{ color: T.accent.primary }}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:open-in-new"
                  width={16}
                  height={16}
                />
                {l.label}
              </Link>
            ))}
            <Link
              href={returnTo}
              className="flex min-h-12 items-center gap-2 border-t border-(--t-border-line) py-3 font-semibold underline underline-offset-4 hover:text-(--t-accent-primary-hover)"
              style={{ color: T.accent.primary }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-left"
                width={16}
                height={16}
              />
              Back to the queue
            </Link>
          </nav>
        </aside>
      </div>
    </>
  )
}
