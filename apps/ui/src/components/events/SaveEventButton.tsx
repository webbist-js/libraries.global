"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"

interface SaveEventButtonProps {
  documentId: string
  size?: "sm" | "md"
}

export function SaveEventButton({
  documentId,
  size = "sm",
}: SaveEventButtonProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedDocId, setSavedDocId] = useState<string | null>(null)

  // Check if already saved on mount
  useEffect(() => {
    fetch("/api/saved-events", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { documentId: string; eventDocumentId: string }[]) => {
        const match = list.find((s) => s.eventDocumentId === documentId)
        if (match) {
          setSaved(true)
          setSavedDocId(match.documentId)
        }
      })
      .catch(() => {})
  }, [documentId])

  async function toggle() {
    setSaving(true)
    if (saved && savedDocId) {
      await fetch(`/api/saved-events/${savedDocId}`, {
        method: "DELETE",
        credentials: "include",
      })
      setSaved(false)
      setSavedDocId(null)
    } else {
      const res = await fetch("/api/saved-events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDocumentId: documentId }),
      })
      if (res.ok) {
        const data = (await res.json()) as { documentId: string }
        setSaved(true)
        setSavedDocId(data.documentId)
      }
    }
    setSaving(false)
  }

  const iconSize = size === "sm" ? "size-3.5" : "size-4"

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title={saved ? "Remove from saved" : "Save event"}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-2 text-xs"}`}
      style={{
        fontFamily: T.font.mono,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        borderColor: saved ? "rgba(127,223,255,0.3)" : T.border.line,
        color: saved ? T.accent.aurora : T.ink.ghost,
        background: saved ? "rgba(127,223,255,0.07)" : "transparent",
      }}
    >
      <Icon
        icon={saved ? "mdi:bookmark" : "mdi:bookmark-outline"}
        className={iconSize}
      />
      {saved ? "Saved" : "Save"}
    </button>
  )
}
