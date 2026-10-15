"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { captureAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"

interface SaveEventButtonProps {
  documentId: string
  size?: "sm" | "md"
}

export function SaveEventButton({
  documentId,
  size = "sm",
}: SaveEventButtonProps) {
  const tUi = useUiTranslations("ui")

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
    if (saving) return
    const measured = captureAnalyticsEvent("event_action", {
      interaction_source: "event_save",
      action_type: saved ? "unsave" : "save",
      content_id: documentId,
    })
    setSaving(true)
    try {
      if (saved && savedDocId) {
        const res = await fetch(`/api/saved-events/${savedDocId}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok) return
        measured()
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
          if (!data.documentId) return
          measured()
          setSaved(true)
          setSavedDocId(data.documentId)
        }
      }
    } catch {
      // Leave the confirmed save state intact when the request fails.
    } finally {
      setSaving(false)
    }
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
        borderColor: saved ? "var(--t-aurora-soft)" : T.border.line,
        color: saved ? T.accent.aurora : T.ink.ghost,
        background: saved ? "var(--t-aurora-soft)" : "transparent",
      }}
    >
      <Icon
        icon={saved ? "mdi:bookmark" : "mdi:bookmark-outline"}
        className={iconSize}
      />
      {saved ? tUi("saved") : tUi("save")}
    </button>
  )
}
