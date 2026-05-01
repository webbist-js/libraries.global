"use client"

import { T } from "@/lib/design-tokens"

import { useWikiEdit } from "./WikiArticleEditContext"

export function WikiArticleEditToggle() {
  const { canEdit, editMode, setEditMode } = useWikiEdit()

  if (!canEdit) return null

  return (
    <button
      onClick={() => setEditMode(!editMode)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderRadius: "8px",
        border: `1px solid ${editMode ? "rgba(127,223,255,.3)" : T.border.line}`,
        background: editMode ? "rgba(127,223,255,.08)" : T.bg.surface,
        fontFamily: T.font.mono,
        fontSize: "11px",
        color: editMode ? T.accent.aurora : T.ink.dim,
        letterSpacing: ".06em",
        cursor: "pointer",
      }}
    >
      {editMode ? "Exit edit" : "Edit"}
    </button>
  )
}
