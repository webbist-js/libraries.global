import { Icon } from "@iconify/react"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import {
  ArticleReviewPanel,
  ClaimPanel,
  detailOf,
  EVIDENCE_TYPE_LABELS,
  FacilitiesPanel,
  FieldsList,
  formatDateTime,
  KeyValueList,
  LocationRequestPanel,
  type ModerationDetail,
  moderationRowLabel,
  NewLibraryPanel,
  RecordChangesTable,
  ReviewDecisionForm,
  type ReviewEvent,
  ReviewThread,
  RoleApplicationPanel,
  StatusBadge,
} from "@/components/moderation"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { userIsArticleEditor } from "@/lib/editor-gate"
import { fetchModeration } from "@/lib/moderation-proxy"
import { Link } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import {
  fetchPlaceLink,
  type PlaceKind,
  type PlaceLink,
} from "@/lib/strapi-api/content/server"

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
      className="flex flex-col gap-4 rounded-[20px] p-5 sm:p-6"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <h2
        className="m-0 text-[20px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

const isArticle = (t: string) => t === "wiki_edit" || t === "blog_submission"

const asRecord = (v: unknown) =>
  (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<
    string,
    unknown
  >
const idOf = (v: unknown) => (typeof v === "string" && v ? v : null)

/** What a panel needs beyond the detail, read on the server. */
type PanelContext = {
  country: PlaceLink | null
  region: PlaceLink | null
  /** Locale code → name. */
  localeNames: Record<string, string>
}

/**
 * A Location Request's parents as approval will use them: the Moderator's
 * target when it names any place, else the request's own ids.
 */
async function locationParents(
  d: ModerationDetail
): Promise<Pick<PanelContext, "country" | "region">> {
  const target = asRecord(d.draftData?.moderatorTarget)
  const useTarget = ["continent", "country", "region", "area"].some((k) =>
    idOf(target[k])
  )
  const fields = d.fields ?? {}
  const countryId = useTarget
    ? idOf(target.country)
    : idOf(fields.countryDocumentId)
  const regionId = useTarget
    ? idOf(target.region)
    : idOf(fields.regionDocumentId)
  const [country, region] = await Promise.all([
    countryId ? fetchPlaceLink("country", countryId) : null,
    regionId && fields.kind === "area"
      ? fetchPlaceLink("region", regionId)
      : null,
  ])

  return { country, region }
}

/** The record an approval created: what it is and where to open it. */
async function createdRecord(
  d: ModerationDetail
): Promise<{ label: string; link: PlaceLink | null } | null> {
  if (!d.resultDocumentId) return null
  let kind: PlaceKind | null = null
  if (d.submissionType === "new_library") kind = "library"
  else if (d.submissionType === "location_request")
    kind = d.fields?.kind === "area" ? "area" : "region"
  if (!kind) return null
  const link = await fetchPlaceLink(kind, d.resultDocumentId)
  const label =
    kind === "library"
      ? link?.href?.startsWith("/contribute/")
        ? "Open the new library in the Index editor"
        : "Open the new library"
      : kind === "area"
        ? "Open the region of the new area"
        : "Open the new region"

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
  library_claim: (d) => (
    <ClaimPanel fields={d.fields} targetSlug={d.targetSlug} />
  ),
  wiki_edit: (d) => <ArticleReviewPanel detail={d} />,
  blog_submission: (d) => <ArticleReviewPanel detail={d} />,
  new_library: (d) => (
    <NewLibraryPanel
      documentId={d.documentId}
      status={d.status}
      fields={d.fields}
      draftData={d.draftData}
      pendingLocationRequest={d.pendingLocationRequest === true}
    />
  ),
  location_request: (d, ctx) => (
    <LocationRequestPanel
      documentId={d.documentId}
      status={d.status}
      fields={d.fields}
      draftData={d.draftData}
      country={ctx.country}
      region={ctx.region}
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
  correction: (d) => {
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
  location_request: "The requested place",
  role_application: "The application",
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
    ["correction", "library_edit", "library_claim"].includes(d.submissionType)
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
          className="m-0 rounded-[14px] px-4 py-3 text-[15px]"
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
}: {
  params: Promise<{ locale: string; documentId: string }>
}) {
  const { documentId } = await params
  const { user } = await requireModerator(
    `/contribute/moderation/${encodeURIComponent(documentId)}`
  )
  if (!isDocumentIdParam(documentId)) notFound()

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
  const [parents, created] = await Promise.all([
    d.submissionType === "location_request"
      ? locationParents(d)
      : Promise.resolve({ country: null, region: null }),
    createdRecord(d),
  ])
  const panelContext: PanelContext = {
    ...parents,
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
          <span className="text-[15px]" style={{ color: T.ink.dim }}>
            {`${moderationRowLabel(d)} · ${language}`}
          </span>
        </div>
      </ModerationHero>

      <div className="mx-auto grid w-full max-w-[1360px] gap-8 px-4 pt-8 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="About this submission">
            <KeyValueList
              rows={[
                { label: "Type", value: moderationRowLabel(d) },
                { label: "Change", value: detailOf(d) ?? "" },
                {
                  label: "Contributor",
                  value: d.submittedByName ?? "Anonymous",
                },
                { label: "Submitted", value: formatDateTime(d.createdAt) },
                { label: "Language", value: language },
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
            <Section title="The contributor’s note">
              <p
                className="m-0 text-[15px] leading-[1.6] whitespace-pre-wrap"
                style={{ color: T.ink.base }}
              >
                {contributorNote}
              </p>
            </Section>
          ) : null}

          <Section title={PANEL_TITLES[d.submissionType] ?? "Proposed changes"}>
            {panel}
          </Section>
        </div>

        <aside
          aria-label="Decision"
          className="flex flex-col gap-6 self-start lg:sticky lg:top-24"
        >
          <Section title="Your decision">
            <ReviewDecisionForm
              documentId={d.documentId}
              status={d.status}
              canPublish={d.canPublish}
              reviewedAt={d.reviewedAt}
            />
          </Section>
          <Section title="History">
            {d.reviewNote && events.every((e) => !e.note) ? (
              <p className="m-0 text-[14px]" style={{ color: T.ink.base }}>
                <strong>Moderator note: </strong>
                {d.reviewNote}
              </p>
            ) : null}
            <ReviewThread events={events} />
          </Section>
          <nav
            aria-label="Related pages"
            className="flex flex-col gap-2 text-[15px]"
          >
            {created?.link?.href ? (
              <Link
                href={created.link.href}
                className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
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
                {d.submissionType === "location_request"
                  ? "Approval created this place in the atlas."
                  : "Approval created a new library record."}
              </p>
            ) : null}
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
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
              href="/contribute/moderation"
              className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
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
