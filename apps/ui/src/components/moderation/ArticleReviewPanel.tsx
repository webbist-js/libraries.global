import { Badge } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { extractText, type ModerationDetail } from "./submissionMeta"

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

type Side = {
  heading: string
  locale: string | null
  title: string | null
  summary: string | null
  body: string
}

function Column({ side }: { side: Side }) {
  return (
    <section
      aria-label={side.heading}
      className="flex min-w-0 flex-col gap-3 rounded-[14px] p-4"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3
          className="m-0 text-[14px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          {side.heading}
        </h3>
        {side.locale ? (
          <Badge label={side.locale.toUpperCase()} color="dim" />
        ) : null}
      </div>
      {side.title ? (
        <p
          className="m-0 text-[22px] leading-tight"
          style={{ fontFamily: T.font.serif, color: T.ink.base }}
        >
          {side.title}
        </p>
      ) : null}
      {side.summary ? (
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {side.summary}
        </p>
      ) : null}
      {side.body ? (
        <div
          className="max-h-[36rem] overflow-y-auto text-[15px] leading-[1.6] whitespace-pre-wrap"
          style={{ color: T.ink.base }}
        >
          {side.body}
        </div>
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.faint }}>
          No body text.
        </p>
      )}
    </section>
  )
}

/**
 * A Knowledge (`wiki_edit`) or Journal (`blog_submission`) submission: what
 * it proposes beside what is live. A translation shows the source locale
 * beside the translation, each with its locale badge. The live versions
 * come from Strapi (`detail.article`), never from the contributor.
 */
export function ArticleReviewPanel({
  detail,
}: {
  readonly detail: Pick<
    ModerationDetail,
    | "submissionType"
    | "draftData"
    | "fields"
    | "locale"
    | "article"
    | "editSummary"
    | "canPublish"
    | "targetSlug"
  >
}) {
  const draft = detail.draftData ?? {}
  const fields = detail.fields ?? {}
  const isJournal = detail.submissionType === "blog_submission"
  const isNew = draft.kind === "new_article" || fields.kind === "new_article"
  const isTranslation =
    draft.isTranslation === true || fields.isTranslation === true
  const isSuggestion =
    !Array.isArray(draft.body) && Array.isArray(draft.proposedBody)
  const proposal = str(fields.proposal)
  const category = str(fields.category)
  const editSummary = str(draft.editSummary) ?? detail.editSummary

  const proposed: Side = {
    heading: isTranslation ? "Translation" : isNew ? "New article" : "Proposed",
    locale: detail.locale,
    title: str(draft.title) ?? str(draft.proposedTitle) ?? str(fields.title),
    summary:
      str(draft.summary) ?? str(draft.proposedSummary) ?? str(fields.summary),
    body: extractText(
      Array.isArray(draft.body)
        ? draft.body
        : Array.isArray(draft.proposedBody)
          ? draft.proposedBody
          : null
    ),
  }
  const source = detail.article?.source
  const current = detail.article?.current
  const live: Side | null =
    isTranslation && source
      ? {
          heading: "Source",
          locale: source.locale,
          title: str(source.title),
          summary: str(source.summary),
          body: extractText(source.body),
        }
      : current
        ? {
            heading: isTranslation ? "Current translation" : "Live version",
            locale: detail.locale,
            title: str(current.title),
            summary: str(current.summary),
            body: extractText(current.body),
          }
        : null

  const kindLabel = isNew
    ? "New article"
    : isTranslation
      ? `Translation into ${detail.locale.toUpperCase()}`
      : isSuggestion || proposal
        ? "Suggested change"
        : "Direct edit"
  const outcome = proposal
    ? "A free-text report: nothing is applied automatically. Make the change by hand, then approve to credit the reporter."
    : detail.canPublish
      ? `${isNew ? "Approve creates the article as a draft" : "Approve writes this to the article's draft version"} for an editor to publish. Approve and publish puts it live at once.`
      : isNew
        ? "Approving creates the article; its author can publish in this language, so it goes live."
        : "Approving publishes this change to the article straight away."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          label={isJournal ? "Journal" : "Knowledge"}
          color={isJournal ? "ember" : "violet"}
        />
        <Badge label={kindLabel} color="dim" />
        <Badge label={detail.locale.toUpperCase()} color="dim" />
        {detail.targetSlug ? (
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            {detail.targetSlug}
          </span>
        ) : null}
      </div>
      <p
        className="m-0 rounded-[14px] px-4 py-3 text-[14px] leading-[1.55]"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          color: T.ink.dim,
        }}
      >
        <strong style={{ color: T.ink.base }}>On approval: </strong>
        {outcome}
      </p>
      {editSummary ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
          <strong>Edit summary: </strong>
          {editSummary}
        </p>
      ) : null}
      {proposal ? (
        <div className="flex flex-col gap-1">
          <h3
            className="m-0 text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {category ? `Proposal · ${category}` : "Proposal"}
          </h3>
          <p
            className="m-0 text-[15px] leading-[1.6] whitespace-pre-wrap"
            style={{ color: T.ink.base }}
          >
            {proposal}
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${live ? "lg:grid-cols-2" : ""}`.trim()}>
          {live ? <Column side={live} /> : null}
          <Column side={proposed} />
        </div>
      )}
    </div>
  )
}
