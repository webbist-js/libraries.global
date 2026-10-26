"use client"

import type { TeamWidget } from "@repo/shared-data"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { OriginEditor, WidgetEmbed } from "@/components/widgets/WidgetPublish"
import { Link } from "@/lib/navigation"
import type { WidgetWorkspace } from "@/lib/widgets/client"

export function WidgetManage({
  workspace,
  widget,
  onAction,
  busy,
  siteUrl,
}: {
  readonly workspace: WidgetWorkspace
  readonly widget: TeamWidget
  readonly onAction: (
    action: string,
    body?: Record<string, unknown>
  ) => Promise<void>
  readonly busy: boolean
  readonly siteUrl: string
}) {
  const team = workspace.team,
    [confirmation, setConfirmation] = useState<{
      action: string
      title: string
      body?: Record<string, unknown>
    } | null>(null),
    [origins, setOrigins] = useState(widget.origins)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Badge
          label={team.active ? widget.state : "Unavailable — Team inactive"}
          color={widget.state === "live" && team.active ? "ok" : "warn"}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            variant="surface"
            size="pill"
            disabled={busy || !team.active}
            onClick={() => onAction("duplicate")}
          >
            Duplicate as draft
          </Button>
          {team.organiser ? (
            <>
              <Button
                variant="surface"
                size="pill"
                disabled={
                  busy || !widget.publishedVersion || widget.state === "paused"
                }
                onClick={() =>
                  setConfirmation({
                    action: "pause",
                    title: "Pause this widget?",
                  })
                }
              >
                Pause
              </Button>
              <Button
                variant="surface"
                size="pill"
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    action: "unpublish",
                    title: "Unpublish this widget?",
                  })
                }
              >
                Unpublish
              </Button>
              <Button
                variant="surface"
                size="pill"
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    action: "archive",
                    title: "Archive this widget permanently?",
                  })
                }
              >
                Archive
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <StaffPanel title="Publication history">
          <p className="mb-5 text-sm text-(--t-ink-dim)">
            Restoring copies a previous configuration and selection into a new
            draft. Review and publish it to change the live widget. Showing the
            latest 50 publications.
          </p>
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {widget.history.map((r) => (
              <li
                key={r.documentId}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <strong>Version {r.version}</strong>
                  <p className="mt-1 text-sm text-(--t-ink-dim)">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }).format(new Date(r.publishedAt))}
                  </p>
                  <p className="mt-1 text-sm">
                    {r.config.title} · {r.selectionName} v{r.selectionVersion}
                  </p>
                </div>
                {widget.release?.documentId === r.documentId ? (
                  <Badge label="Current publication" color="ok" />
                ) : null}
                {team.organiser ? (
                  <Button
                    variant="surface"
                    size="pill"
                    disabled={busy || !team.active}
                    onClick={() =>
                      setConfirmation({
                        action: "restore",
                        title: `Restore version ${r.version} to the draft?`,
                        body: { releaseId: r.documentId },
                      })
                    }
                  >
                    Restore to draft
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {!widget.history.length ? <p>No publications yet.</p> : null}
          <Link
            href={`/staff/teams/widgets/${widget.documentId}/publish`}
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
          >
            Review and publish the draft
          </Link>
        </StaffPanel>
        <StaffPanel title="Aggregate usage">
          <p className="font-serif text-5xl">{widget.loads.toLocaleString()}</p>
          <p className="mt-2 text-sm">
            Widget data loads since creation. These are requests, not unique
            visitors.
          </p>
          <p className="mt-5 text-sm">
            {widget.blockedReports.toLocaleString()} browser reports of blocked
            framing. Reports are incomplete and do not identify all attempted
            embeds.
          </p>
          <p className="mt-4 text-xs text-(--t-ink-dim)">
            No visitor identities, locations, searches or page URLs are stored
            by widgets. Allowed origins describe permission, not proof of
            installation.
          </p>
        </StaffPanel>
      </div>
      <StaffPanel title="Allowed websites">
        <OriginEditor
          initial={widget.origins}
          onChange={setOrigins}
          disabled={!team.organiser || !team.active || busy}
        />
        {team.organiser ? (
          <Button
            className="mt-4"
            variant="primary"
            size="pill"
            disabled={busy || !team.active}
            onClick={() => onAction("origins", { origins })}
          >
            Save allowed websites
          </Button>
        ) : null}
      </StaffPanel>
      {widget.publishedVersion > 0 ? (
        <WidgetEmbed widget={widget} siteUrl={siteUrl} />
      ) : null}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
      >
        <DialogContent>
          <DialogTitle>{confirmation?.title}</DialogTitle>
          <DialogDescription>
            {confirmation?.action === "restore"
              ? "The live publication stays available until you publish the restored draft."
              : confirmation?.action === "archive"
                ? "The widget disappears from the workspace and its public address will stay unavailable. Its address cannot be reused."
                : "The public widget will show a neutral unavailable message on its next load. Its saved configuration and publication history are retained."}
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="surface"
              size="pill"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="pill"
              disabled={busy}
              onClick={async () => {
                if (confirmation) {
                  await onAction(confirmation.action, confirmation.body)
                  setConfirmation(null)
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
