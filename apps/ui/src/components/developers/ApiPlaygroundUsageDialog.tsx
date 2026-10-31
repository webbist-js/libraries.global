"use client"

import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { savePromptSetting } from "@/lib/dismissed-prompts"

/** Closing acknowledges this visit; only an explicit choice persists. */
export function ApiPlaygroundUsageDialog({
  teamName,
  onDismiss,
}: {
  teamName: string
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(true)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  async function acknowledge() {
    if (saving) return
    setError(false)
    if (dontShowAgain) {
      setSaving(true)
      const saved = await savePromptSetting("api-playground-usage", true)
      setSaving(false)
      if (!saved) {
        setError(true)

        return
      }
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next)
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto overscroll-contain rounded-3xl border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) motion-reduce:animate-none sm:p-8"
        showCloseButton={!saving}
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (saving) event.preventDefault()
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onDismiss()
        }}
        aria-busy={saving}
      >
        <DialogHeader className="gap-3 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="type-h2 m-0 pr-12 outline-none"
            style={{ outline: "none" }}
          >
            These requests use your API allowance
          </DialogTitle>
          <DialogDescription className="m-0 text-base leading-relaxed [overflow-wrap:anywhere] text-(--t-ink-dim)">
            This playground calls the real API. Successful requests and response
            data count toward {teamName}’s shared monthly allowance, just like
            requests from your applications.
          </DialogDescription>
        </DialogHeader>
        <p className="m-0 rounded-2xl bg-(--t-accent-chip) p-4 text-sm leading-relaxed">
          “Run request” and “Read this record” each send a request. Opening this
          page does not use any allowance. Errors do not consume monthly
          allowance.
        </p>
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base">
            <input
              type="checkbox"
              name="hide-playground-usage-warning"
              checked={dontShowAgain}
              disabled={saving}
              onChange={(event) => {
                setDontShowAgain(event.target.checked)
                setError(false)
              }}
              className="mt-1 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            />
            Don’t show this again
          </label>
          <p className="m-0 mt-1 text-sm text-(--t-ink-dim)">
            You can turn this warning back on in Settings → Notifications →
            Prompts.
          </p>
        </div>
        {error ? (
          <p role="alert" className="m-0 text-sm">
            Couldn’t save your preference. Try again, or uncheck “Don’t show
            this again” to continue for this visit.
          </p>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="pill"
          disabled={saving}
          onClick={() => void acknowledge()}
        >
          {saving ? "Saving…" : "Continue to playground"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
