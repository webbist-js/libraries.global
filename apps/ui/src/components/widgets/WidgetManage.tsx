"use client"

import { Icon } from "@iconify/react"
import type { TeamWidget } from "@repo/shared-data"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { EmptyState } from "@/components/ds/EmptyState"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button, buttonVariants } from "@/components/ui/button"
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
        <p className="m-0 text-sm text-(--t-ink-dim)">
          {!widget.publishedVersion
            ? "Only your Team can see this draft."
            : "Manage the version that visitors see and keep previous publications for reference."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="surface"
            size="pill"
            disabled={busy || !team.active}
            onClick={() => onAction("duplicate")}
          >
            Duplicate as draft
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <StaffPanel title="Publication history">
          {widget.history.length ? (
            <p className="mb-5 text-sm text-(--t-ink-dim)">
              Restoring copies a previous configuration and selection into a new
              draft. Review and publish it to change the live widget. Showing
              the latest 50 publications.
            </p>
          ) : null}
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
          {!widget.history.length ? (
            <EmptyState
              compact
              icon="mdi:history"
              lead="Your first publication starts here"
              detail="Each publication will appear here, so you can restore an earlier design later."
              action={
                <Link
                  className={buttonVariants({
                    variant: "primary",
                    size: "pill",
                  })}
                  href={`/staff/teams/widgets/${widget.documentId}/publish`}
                >
                  Review and publish the draft
                </Link>
              }
            />
          ) : null}
          {widget.history.length ? (
            <Link
              href={`/staff/teams/widgets/${widget.documentId}/publish`}
              className="mt-4 inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
            >
              Review and publish the draft
            </Link>
          ) : null}
        </StaffPanel>
        <StaffPanel title="Aggregate usage">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-(--t-bg-surface) p-4">
              <Icon
                aria-hidden
                icon="mdi:chart-line"
                width={22}
                className="mb-3 text-(--t-accent-primary)"
              />
              <p className="font-sans text-4xl tabular-nums">
                {widget.loads.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-(--t-ink-dim)">
                Data loads
              </p>
            </div>
            <div className="rounded-2xl bg-(--t-bg-surface) p-4">
              <Icon
                aria-hidden
                icon="mdi:shield-outline"
                width={22}
                className="mb-3 text-(--t-ink-dim)"
              />
              <p className="font-sans text-4xl tabular-nums">
                {widget.blockedReports.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-semibold text-(--t-ink-dim)">
                Blocked reports
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-(--t-ink-dim)">
            Totals since creation. Loads count data requests, rather than unique
            visitors. Browser reports of blocked embeds may be incomplete.
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
      {team.organiser ? (
        <WidgetLifecycle
          widget={widget}
          busy={busy}
          active={team.active}
          onConfirm={setConfirmation}
        />
      ) : null}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
      >
        <DialogContent>
          <DialogTitle className="type-h2">{confirmation?.title}</DialogTitle>
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

function WidgetLifecycle({
  widget,
  busy,
  onConfirm,
  active,
}: {
  readonly active: boolean
  readonly widget: TeamWidget
  readonly busy: boolean
  readonly onConfirm: (value: { action: string; title: string }) => void
}) {
  return (
    <StaffPanel title="Widget lifecycle" compact>
      <p className="mb-4 text-sm text-(--t-ink-dim)">
        {widget.publishedVersion
          ? "Pause or unpublish to take this widget offline. Archive it when you no longer need it."
          : "This draft is private to your Team. Archive it if you no longer need it."}{" "}
        Your publication history is retained.
      </p>
      <div className="flex flex-wrap gap-3">
        {active && widget.state === "paused" ? (
          <Link
            className={buttonVariants({ variant: "surface", size: "pill" })}
            href={`/staff/teams/widgets/${widget.documentId}/publish`}
          >
            Review & resume
          </Link>
        ) : null}
        {widget.publishedVersion > 0 &&
        widget.state !== "paused" &&
        widget.state !== "unpublished" ? (
          <Button
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={() =>
              onConfirm({
                action: "pause",
                title: "Pause this widget?",
              })
            }
          >
            Pause widget
          </Button>
        ) : null}
        {widget.publishedVersion > 0 && widget.state !== "unpublished" ? (
          <Button
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={() =>
              onConfirm({
                action: "unpublish",
                title: "Unpublish this widget?",
              })
            }
          >
            Unpublish
          </Button>
        ) : null}
        <Button
          variant="surface"
          size="pill"
          disabled={busy}
          onClick={() =>
            onConfirm({
              action: "archive",
              title: "Archive this widget permanently?",
            })
          }
        >
          Archive
        </Button>
      </div>
    </StaffPanel>
  )
}
