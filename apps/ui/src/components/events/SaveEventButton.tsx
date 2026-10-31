"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { captureAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface SaveEventButtonProps {
  documentId: string
  size?: "sm" | "md"
}

export function SaveEventButton({
  documentId,
  size = "sm",
}: SaveEventButtonProps) {
  const tUi = useUiTranslations("ui")

  const t = useUiTranslations("eventActions")
  const [readState, setReadState] = useState<
    "loading" | "ready" | "signedOut" | "error"
  >("loading")
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedDocId, setSavedDocId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setReadState("loading")
    setSaved(false)
    setSavedDocId(null)
    setError(false)
    fetch("/api/saved-events", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) setReadState("signedOut")

          return
        }
        if (!response.ok) throw new Error("Saved events unavailable")
        const list = (await response.json()) as {
          documentId: string
          eventDocumentId: string
        }[]
        if (!Array.isArray(list))
          throw new Error("Invalid saved events response")
        if (controller.signal.aborted) return
        const match = list.find((event) => event.eventDocumentId === documentId)
        setSaved(!!match)
        setSavedDocId(match?.documentId ?? null)
        setReadState("ready")
      })
      .catch(() => {
        if (!controller.signal.aborted) setReadState("error")
      })

    return () => controller.abort()
  }, [documentId, revision])

  async function toggle() {
    if (saving || readState === "loading") return
    if (readState === "error") {
      setRevision((value) => value + 1)

      return
    }
    if (readState === "signedOut") {
      setError(true)

      return
    }
    setError(false)
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
        if (!res.ok) throw new Error("Save failed")
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
        if (!res.ok) throw new Error("Save failed")
        {
          const data = (await res.json()) as { documentId: string }
          if (!data.documentId) throw new Error("Missing saved event")
          measured()
          setSaved(true)
          setSavedDocId(data.documentId)
        }
      }
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const iconSize = size === "sm" ? "size-3.5" : "size-4"

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={saving || readState === "loading"}
        aria-busy={saving || readState === "loading"}
        aria-pressed={saved}
        title={saved ? t("remove") : t("save")}
        className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-xs"}`}
        style={{
          fontFamily: T.font.mono,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          borderColor: saved ? "var(--t-aurora-soft)" : T.border.line,
          color: saved ? T.accent.aurora : T.ink.dim,
          background: saved ? "var(--t-aurora-soft)" : "transparent",
        }}
      >
        <Icon
          icon={saved ? "mdi:bookmark" : "mdi:bookmark-outline"}
          className={iconSize}
        />
        {readState === "error"
          ? t("retry")
          : saved
            ? tUi("saved")
            : tUi("save")}
      </button>
      {(error || readState === "error") && (
        <span
          role="status"
          className="text-xs normal-case"
          style={{ color: T.ink.dim }}
        >
          {readState === "signedOut" ? (
            <Link href="/auth/signin">{t("signIn")}</Link>
          ) : readState === "error" ? (
            t("readUnavailable")
          ) : (
            t("saveUnavailable")
          )}
        </span>
      )}
    </span>
  )
}
