"use client"

import { useWikiEdit } from "./WikiArticleEditContext"
import { WikiEditorSidebar } from "./WikiEditorSidebar"

export function WikiArticleEditSidebarPanel() {
  const { editMode, submissionId, handleFinalize } = useWikiEdit()

  if (!editMode) return null

  return (
    <WikiEditorSidebar submissionId={submissionId} onSubmit={handleFinalize} />
  )
}
