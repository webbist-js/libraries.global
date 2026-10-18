"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { EDITORIAL_SUBTLE_PILL } from "@/components/ds/EditorialToolbar"
import { cn } from "@/lib/styles"

import { discussionRequest, type DiscussionContextLink } from "./api"

export function DiscussionContextActions({
  link,
  onChanged,
  size = "sm",
}: {
  link: DiscussionContextLink
  onChanged: () => void
  size?: "sm" | "md"
}) {
  const t = useTranslations("discussions")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [feedback, setFeedback] = useState("")
  if (!link.canManage) return null
  const act = async (action: string) => {
    setBusy(true)
    setError(false)
    try {
      await discussionRequest(
        `context-links/${encodeURIComponent(link.id)}`,
        "PUT",
        {
          action,
          baseVersion: link.version,
          ...(action === "reject" ? { feedback } : {}),
        }
      )
      onChanged()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  const pill = cn(
    EDITORIAL_SUBTLE_PILL,
    size === "md" && "min-h-10 px-4 text-sm"
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {link.state === "pending" ? (
        link.canReview && (
          <>
            <button
              type="button"
              disabled={busy}
              className={pill}
              onClick={() => act("approve")}
            >
              {t("acceptLink")}
            </button>
            <button
              type="button"
              disabled={busy}
              className={pill}
              onClick={() => setDeclining(!declining)}
            >
              {t("reject")}
            </button>
          </>
        )
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            className={pill}
            onClick={() => act(link.featured ? "unfeature" : "feature")}
          >
            {t(link.featured ? "unfeatureConversation" : "featureConversation")}
          </button>
          <button
            type="button"
            disabled={busy}
            className={cn(
              pill,
              "border-(--t-palette-coral-fg)/30 text-(--t-palette-coral-fg) hover:border-(--t-palette-coral-fg)"
            )}
            onClick={() => act("remove")}
          >
            {t("unlinkConversation")}
          </button>
        </>
      )}
      {declining && (
        <div className="grid w-full gap-2">
          <label className="text-xs">
            {t("feedback")}
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              maxLength={1000}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>
          <button
            type="button"
            disabled={busy || !feedback.trim()}
            className={pill}
            onClick={() => act("reject")}
          >
            {t("reject")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="w-full text-xs">
          {t("error")}
        </p>
      )}
    </div>
  )
}
