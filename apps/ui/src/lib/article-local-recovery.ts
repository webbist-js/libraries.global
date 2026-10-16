import type { ArticleDraft } from "@/components/contribute/article-editor/article.types"

export const ARTICLE_COPY_PREFIX = "libraries-global:article-copy:v1:"
export type ArticleLocalCopy = {
  owner: string
  target: string
  locale: string
  submissionId: string | null
  baseRevision: string | null
  writtenAt: string
  draft: ArticleDraft
}
export function articleCopyKey(
  owner: string,
  target: string,
  locale: string
): string {
  return `${ARTICLE_COPY_PREFIX}${encodeURIComponent(owner)}:${encodeURIComponent(target)}:${encodeURIComponent(locale)}`
}
export function readArticleCopy(
  key: string,
  owner: string
): ArticleLocalCopy | null {
  try {
    const copy = JSON.parse(
      localStorage.getItem(key) ?? "null"
    ) as ArticleLocalCopy | null

    return copy?.owner === owner &&
      typeof copy.writtenAt === "string" &&
      typeof copy.draft?.title === "string" &&
      typeof copy.draft.summary === "string" &&
      copy.draft.doc?.type === "doc" &&
      Array.isArray(copy.draft.sections) &&
      Array.isArray(copy.draft.tags)
      ? copy
      : null
  } catch {
    return null
  }
}
export function saveArticleCopy(key: string, copy: ArticleLocalCopy): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(copy))

    return true
  } catch {
    return false
  }
}
export function removeArticleCopy(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Storage failures must never lose live editor text. */
  }
}
