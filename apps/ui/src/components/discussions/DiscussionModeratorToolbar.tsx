"use client"

import { useTranslations } from "next-intl"

import {
  EditorialToolbar,
  EDITORIAL_ACTION_PILL,
} from "@/components/ds/EditorialToolbar"
import { cn } from "@/lib/styles"

import type { DiscussionRecord } from "./api"

export function DiscussionModeratorToolbar({
  thread,
  total,
  globalTotal,
  busy,
  preview,
  onPreview,
  onAction,
}: {
  thread: DiscussionRecord
  total: number | null
  globalTotal: number | null
  busy: boolean
  preview: boolean
  onPreview: () => void
  onAction: (action: "pin" | "unpin" | "lock" | "unlock") => void
}) {
  const t = useTranslations("discussions")
  const pill = EDITORIAL_ACTION_PILL

  return (
    <EditorialToolbar
      ariaLabel={t("moderationControls")}
      label={t(preview ? "memberPreview" : "moderatorView")}
      description={
        !preview ? (
          <>
            {total === null ? t("loading") : t("waitingHere", { count: total })}
            {globalTotal !== null
              ? ` · ${t("waitingAll", { count: globalTotal })}`
              : ""}
          </>
        ) : undefined
      }
      actions={
        <>
          {!preview && thread.state === "visible" && (
            <>
              <button
                type="button"
                className={pill}
                disabled={busy}
                onClick={() => onAction(thread.pinned ? "unpin" : "pin")}
              >
                {t(thread.pinned ? "unpin" : "pinTop")}
              </button>
              <button
                type="button"
                className={pill}
                disabled={busy}
                onClick={() => onAction(thread.locked ? "unlock" : "lock")}
              >
                {t(thread.locked ? "unlock" : "closeReplies")}
              </button>
            </>
          )}
          <button
            type="button"
            className={cn(
              pill,
              "border-transparent bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface)"
            )}
            onClick={onPreview}
          >
            {t(preview ? "returnModerator" : "previewMember")}
          </button>
        </>
      }
    />
  )
}
