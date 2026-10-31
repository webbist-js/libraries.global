import type { ArticleDraft } from "./article.types"
import {
  dynamicZoneToTiptap,
  tiptapToDynamicZone,
  type TiptapNode,
} from "./articleBlocks"

type EditorMedia = { id: number; url: string; alternativeText: string | null }

/** Keep display metadata beside numeric media references; approval still uses body. */
function draftMedia(node: TiptapNode): EditorMedia[] {
  const image =
    node.type === "image" &&
    typeof node.attrs?.imageId === "number" &&
    typeof node.attrs.src === "string"
      ? [
          {
            id: node.attrs.imageId,
            url: node.attrs.src,
            alternativeText:
              typeof node.attrs.alt === "string" ? node.attrs.alt : null,
          },
        ]
      : []

  return [...image, ...(node.content ?? []).flatMap(draftMedia)]
}

export function articleDraftData(
  draft: ArticleDraft,
  options: {
    mode: "new" | "edit"
    direct: boolean
    locale: string
    targetSlug?: string
    sourceLocale: string
    baseRevision?: string | null
    journal?: boolean
    rebaseRevision?: string | null
  }
): Record<string, unknown> {
  const body = tiptapToDynamicZone(draft.doc)
  const common = {
    locale: options.locale,
    sections: draft.sections,
    tags: draft.tags,
    eventMentions: draft.eventMentions ?? [],
    ...(options.journal
      ? {
          sources: (draft.sources ?? []).filter((source) =>
            Object.values(source).some(
              (value) => typeof value === "string" && value.trim()
            )
          ),
        }
      : {}),
    editSummary: draft.editSummary,
    editorMedia: draftMedia(draft.doc),
    ...(options.mode === "edit"
      ? {
          targetSlug: options.targetSlug,
          isTranslation: options.locale !== options.sourceLocale,
          sourceLocale: options.sourceLocale,
          baseRevision: options.baseRevision,
          ...(options.rebaseRevision
            ? { rebaseRevision: options.rebaseRevision }
            : {}),
        }
      : {}),
  }
  if (options.mode === "new")
    return {
      kind: "new_article",
      title: draft.title,
      summary: draft.summary,
      body,
      ...(options.journal
        ? {
            byline: draft.byline ?? "",
            publicationOrigin: draft.origin ?? "community",
          }
        : {}),
      ...common,
    }
  if (options.direct)
    return { title: draft.title, summary: draft.summary, body, ...common }

  return {
    proposedTitle: draft.title,
    proposedSummary: draft.summary,
    proposedBody: body,
    ...common,
  }
}

/** Understand both historical numeric-ID drafts and populated public bodies. */
export function restoreArticleDraft(
  data: Record<string, unknown>,
  resolveUrl: (url: string) => string
): Partial<ArticleDraft> & {
  locale?: string
  baseRevision?: string
} {
  const rawBody = Array.isArray(data.body)
    ? data.body
    : Array.isArray(data.proposedBody)
      ? data.proposedBody
      : null
  const media = new Map<number, EditorMedia>()
  for (const entry of Array.isArray(data.editorMedia) ? data.editorMedia : []) {
    if (!entry || typeof entry !== "object") continue
    const value = entry as Record<string, unknown>
    if (typeof value.id === "number" && typeof value.url === "string")
      media.set(value.id, {
        id: value.id,
        url: value.url,
        alternativeText:
          typeof value.alternativeText === "string"
            ? value.alternativeText
            : null,
      })
  }
  const body = rawBody?.map((block) => {
    if (!block || typeof block !== "object") return block
    const value = block as Record<string, unknown>

    return value.__component === "content.image-block" &&
      typeof value.image === "number"
      ? { ...value, image: media.get(value.image) ?? value.image }
      : value
  })
  const str = (value: unknown) =>
    typeof value === "string" ? value : undefined

  return {
    title: str(data.title) ?? str(data.proposedTitle),
    summary: str(data.summary) ?? str(data.proposedSummary),
    doc: body ? dynamicZoneToTiptap(body, resolveUrl) : undefined,
    sections: Array.isArray(data.sections)
      ? data.sections.filter((key): key is string => typeof key === "string")
      : undefined,
    tags: Array.isArray(data.tags)
      ? (data.tags as ArticleDraft["tags"])
      : undefined,
    eventMentions: Array.isArray(data.eventMentions)
      ? (data.eventMentions as ArticleDraft["eventMentions"])
      : undefined,
    sources: Array.isArray(data.sources)
      ? (data.sources as ArticleDraft["sources"])
      : undefined,
    editSummary: str(data.editSummary),
    locale: str(data.locale),
    baseRevision: str(data.baseRevision),
    byline: str(data.byline),
    origin:
      (data.publicationOrigin ?? data.origin) === "index"
        ? "index"
        : (data.publicationOrigin ?? data.origin) === "community"
          ? "community"
          : undefined,
  }
}
