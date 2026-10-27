"use client"

import { ChevronDown, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionRecord,
} from "./api"
import { DiscussionModeratorButton } from "./DiscussionModeratorButton"
import { DiscussionParticipantRestriction } from "./DiscussionParticipantRestriction"

/** Record-scoped grants are supplied by the server; every action rechecks them. */
export function DiscussionRecordModerationMenu({
  record,
  kind,
  canRemove,
  canSanction,
  onReload,
}: {
  record: DiscussionRecord
  kind: "thread" | "reply"
  canRemove: boolean
  canSanction: boolean
  onReload: () => Promise<void>
}) {
  const t = useTranslations("discussions")
  const [restrictionOpen, setRestrictionOpen] = useState(false)
  const [removalOpen, setRemovalOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={t("moderatorAction")}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--t-palette-violet-bg) bg-(--t-palette-violet-soft) px-3 py-1 text-xs font-semibold text-(--t-palette-violet-fg)"
          >
            <ShieldCheck size={13} aria-hidden />
            {t("moderateMessage")}
            <ChevronDown size={12} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="rounded-xl border-(--t-border-line) bg-(--t-bg-deep) p-1.5"
        >
          <DropdownMenuLabel>{t("moderatorAction")}</DropdownMenuLabel>
          {canRemove && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setRemovalOpen(true)}
            >
              <Trash2 aria-hidden />
              {t("remove")}
            </DropdownMenuItem>
          )}
          {canSanction && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setRestrictionOpen(true)}
            >
              <ShieldAlert aria-hidden />
              {t("restrictParticipant")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canSanction && (
        <DiscussionParticipantRestriction
          record={record}
          kind={kind}
          onReload={onReload}
          hideTrigger
          open={restrictionOpen}
          onOpenChange={setRestrictionOpen}
        />
      )}
      <Dialog open={removalOpen} onOpenChange={setRemovalOpen}>
        <DialogContent className="rounded-3xl bg-(--t-bg-deep)">
          <DialogTitle className="type-h2">{t("confirmRemoval")}</DialogTitle>
          <DialogDescription>{t("removalLead")}</DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!reason.trim() || !canRemove || busy) return
              setBusy(true)
              setError("")
              try {
                await discussionRequest(
                  `moderation/records/${kind}/${encodeURIComponent(record.id)}`,
                  "PUT",
                  {
                    action: "remove",
                    baseVersion: record.version,
                    contributorFeedback: reason.trim(),
                  }
                )
                await onReload()
                setRemovalOpen(false)
              } catch (failure) {
                setError(t(discussionErrorKey(failure)))
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="text-sm">
              {t("authorFeedback")}
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 w-full rounded-xl border p-3"
              />
            </label>
            <div className="flex gap-3">
              <DiscussionModeratorButton
                type="submit"
                disabled={busy || !reason.trim()}
              >
                {t("confirmRemove")}
              </DiscussionModeratorButton>
              <button type="button" onClick={() => setRemovalOpen(false)}>
                {t("cancel")}
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
