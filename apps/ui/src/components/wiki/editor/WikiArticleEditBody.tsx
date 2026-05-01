"use client"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"

import { useWikiEdit } from "./WikiArticleEditContext"
import { WikiBlockEditor } from "./WikiBlockEditor"

export function WikiArticleEditBody({
  slug,
  locale,
  body,
}: {
  readonly slug: string
  readonly locale: string
  readonly body: Record<string, unknown>[]
}) {
  const {
    editMode,
    submissionId,
    setSubmissionId,
    editSummary,
    setEditSummary,
  } = useWikiEdit()

  if (editMode) {
    return (
      <WikiBlockEditor
        slug={slug}
        locale={locale}
        body={body}
        existingSubmissionId={submissionId}
        onSubmissionIdChange={setSubmissionId}
        editSummary={editSummary}
        onEditSummaryChange={setEditSummary}
      />
    )
  }

  return (
    <div className="article-drop-cap">
      <ArticleBodyBlocks
        blocks={body as Parameters<typeof ArticleBodyBlocks>[0]["blocks"]}
      />
    </div>
  )
}
