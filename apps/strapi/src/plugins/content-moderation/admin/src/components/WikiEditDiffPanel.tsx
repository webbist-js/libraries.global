import { Alert, Badge, Box, Flex, Typography } from "@strapi/design-system"

import type { Submission } from "./submissionMeta"
import { Section } from "./SubmissionPanels"

/** Plain text of a Strapi blocks AST (paragraphs, headings, lists, quotes, code). */
function blocksToText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ""
  const lines: string[] = []
  const inline = (children: unknown): string =>
    Array.isArray(children)
      ? children
          .map((c) => {
            if (!c || typeof c !== "object") return ""
            const child = c as Record<string, unknown>
            if (typeof child.text === "string") return child.text

            return inline(child.children)
          })
          .join("")
      : ""
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue
    const n = node as Record<string, unknown>
    switch (n.type) {
      case "heading":
        lines.push(`${"#".repeat(Number(n.level) || 2)} ${inline(n.children)}`)
        break
      case "list":
        if (Array.isArray(n.children))
          n.children.forEach((item, i) => {
            const li = item as Record<string, unknown>
            lines.push(
              `${n.format === "ordered" ? `${i + 1}.` : "•"} ${inline(li?.children)}`
            )
          })
        break
      case "quote":
        lines.push(`> ${inline(n.children)}`)
        break
      case "code":
        lines.push(`[code] ${inline(n.children).slice(0, 200)}`)
        break
      case "image":
        lines.push("[image]")
        break

      default:
        lines.push(inline(n.children))
    }
  }

  return lines.join("\n")
}

/** Readable text of an article body (dynamic zone) as the editor saved it. */
export function extractText(body: unknown): string {
  if (!Array.isArray(body)) return ""
  const parts: string[] = []
  for (const block of body) {
    if (!block || typeof block !== "object") continue
    const b = block as Record<string, unknown>
    switch (b.__component) {
      case "content.rich-text":
        // Drafts carry Strapi blocks in `body`; the retired block editor
        // saved plain text in `text`. Accept both.
        if (typeof b.text === "string") parts.push(b.text)
        else parts.push(blocksToText(b.body))
        break
      case "content.quote-block":
        if (typeof b.quote === "string")
          parts.push(
            `"${b.quote}"${typeof b.attribution === "string" && b.attribution ? ` — ${b.attribution}` : ""}`
          )
        break
      case "content.callout":
        if (typeof b.body === "string")
          parts.push(
            `[${String(b.type ?? "note")}${typeof b.title === "string" && b.title ? `: ${b.title}` : ""}] ${b.body}`
          )
        break
      case "content.code-block":
        if (typeof b.code === "string")
          parts.push(
            `[code] ${b.code.slice(0, 200)}${b.code.length > 200 ? "…" : ""}`
          )
        break
      case "content.image-block":
        parts.push(
          `[image${typeof b.caption === "string" && b.caption ? `: ${b.caption}` : ""}]`
        )
        break
      // No default
    }
  }

  return parts.filter(Boolean).join("\n\n")
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

/**
 * Review panel for Knowledge (`wiki_edit`) and Journal (`blog_submission`)
 * submissions: a new article, a direct edit, a translation or a suggestion.
 */
export function WikiEditDiffPanel({ sub }: { sub: Submission }) {
  const draft = sub.draftData ?? {}
  const fields = sub.fields ?? {}
  const isJournal = sub.submissionType === "blog_submission"
  const isNew = draft.kind === "new_article" || fields.kind === "new_article"
  const locale = typeof draft.locale === "string" ? draft.locale : "en"
  const isTranslation =
    draft.isTranslation === true || fields.isTranslation === true
  const title =
    str(draft.title) ?? str(draft.proposedTitle) ?? str(fields.title)
  const summary =
    str(draft.summary) ?? str(draft.proposedSummary) ?? str(fields.summary)
  const editSummary = str(draft.editSummary) ?? str(sub.editSummary)
  const body = Array.isArray(draft.body)
    ? draft.body
    : Array.isArray(draft.proposedBody)
      ? draft.proposedBody
      : null
  const bodyText = extractText(body)
  const isSuggestion =
    !Array.isArray(draft.body) && Array.isArray(draft.proposedBody)
  const sections = (
    Array.isArray(draft.sections)
      ? draft.sections
      : Array.isArray(fields.sections)
        ? fields.sections
        : []
  ).filter((s): s is string => typeof s === "string")
  const tags = (
    Array.isArray(draft.tags)
      ? draft.tags
      : Array.isArray(fields.tags)
        ? fields.tags
        : []
  )
    .map((t) =>
      t &&
      typeof t === "object" &&
      typeof (t as { label?: unknown }).label === "string"
        ? `${(t as { kind?: string }).kind ?? "tag"}: ${(t as { label: string }).label}`
        : null
    )
    .filter((t): t is string => !!t)
  const proposal = str(fields.proposal)
  const category = str(fields.category)

  const kindLabel = isNew
    ? "New article"
    : isTranslation
      ? `Translation into ${locale}`
      : isSuggestion || proposal
        ? "Suggested change"
        : "Direct edit"
  const outcome = isNew
    ? "Approving creates the article. It publishes only when the author holds the editor capability; otherwise it lands as a draft in the Content Manager for you to publish."
    : isSuggestion
      ? "Approving writes this to the article's draft version. Publish it from the Content Manager once you've checked it."
      : proposal
        ? "A free-text report: nothing is applied automatically. Make the change by hand, then approve to credit the reporter."
        : "Approving publishes this change to the article straight away."

  return (
    <>
      <Box paddingBottom={4}>
        <Flex gap={2} wrap="wrap" alignItems="center" paddingBottom={3}>
          <Badge active>{isJournal ? "Journal" : "Knowledge"}</Badge>
          <Badge>{kindLabel}</Badge>
          <Badge>{locale.toUpperCase()}</Badge>
          {sub.targetSlug && (
            <Typography variant="pi" textColor="neutral600">
              {sub.targetSlug}
            </Typography>
          )}
        </Flex>
        <Alert
          variant={isSuggestion || isNew || proposal ? "warning" : "default"}
          title="On approval"
          closeLabel="Dismiss"
          onClose={() => {}}
        >
          {outcome}
        </Alert>
      </Box>

      {editSummary && (
        <Section title="Edit summary">
          <Typography>{editSummary}</Typography>
        </Section>
      )}
      {title && (
        <Section title={isNew ? "Title" : "Proposed title"}>
          <Typography variant="beta">{title}</Typography>
        </Section>
      )}
      {summary && (
        <Section title="Summary">
          <Typography>{summary}</Typography>
        </Section>
      )}
      {sections.length > 0 && (
        <Section title={isJournal ? "Section" : "Sections (first is home)"}>
          <Flex gap={1} wrap="wrap">
            {sections.map((s, i) => (
              <Badge key={s} active={i === 0 && !isJournal}>
                {s}
              </Badge>
            ))}
          </Flex>
        </Section>
      )}
      {tags.length > 0 && (
        <Section title="Tags">
          <Flex gap={1} wrap="wrap">
            {tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </Flex>
        </Section>
      )}
      {proposal && (
        <Section title={category ? `Proposal · ${category}` : "Proposal"}>
          <Typography style={{ whiteSpace: "pre-wrap" }}>{proposal}</Typography>
        </Section>
      )}
      {bodyText ? (
        <Section title="Body">
          <Box
            background="neutral100"
            hasRadius
            padding={4}
            style={{ maxHeight: "48rem", overflow: "auto" }}
          >
            <Typography style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {bodyText}
            </Typography>
          </Box>
        </Section>
      ) : !proposal ? (
        <Typography textColor="neutral500">
          No body content in this draft.
        </Typography>
      ) : null}
    </>
  )
}
