"use client"
import type { TeamWidget } from "@repo/shared-data"

import { Badge } from "@/components/ds/Badge"
import { Button } from "@/components/ui/button"
import type { useWidgetDraft } from "@/components/widgets/useWidgetDraft"

function publicationLabel(widget: TeamWidget, active: boolean) {
  if (!active) return "Unavailable — Team inactive"
  if (!widget.publishedVersion) return "Draft only"

  return `${widget.state === "live" ? "Live" : "Published"} v${widget.publishedVersion}${widget.state !== "live" ? ` · ${widget.state}` : ""}`
}

export function WidgetDraftStatus({
  state,
  active,
}: {
  readonly state: ReturnType<typeof useWidgetDraft>
  readonly active: boolean
}) {
  const { widget, phase } = state
  const labels = {
    saving: "Saving draft…",
    pending: "Unsaved changes",
    failed: "Couldn't save",
    conflict: "Concurrent edit",
    saved: `Draft saved ${new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: "UTC" }).format(new Date(widget.updatedAt))}`,
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        label={publicationLabel(widget, active)}
        color={widget.state === "live" ? "ok" : "dim"}
      />
      {widget.hasChanges ? (
        <Badge label="Unpublished changes" color="warn" />
      ) : null}
      <span role="status" className="text-sm">
        {labels[phase]}
      </span>
      {phase === "failed" ? (
        <Button variant="surface" size="pill" onClick={() => state.save()}>
          Retry save now
        </Button>
      ) : null}
    </div>
  )
}
