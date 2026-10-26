"use client"

import type { TeamWidget } from "@repo/shared-data"
import { useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { Button } from "@/components/ui/button"
import { useWidgetDraft } from "@/components/widgets/useWidgetDraft"
import { useWidgetResolution } from "@/components/widgets/useWidgetResolution"
import { WidgetBuilder } from "@/components/widgets/WidgetBuilder"
import { WidgetError } from "@/components/widgets/WidgetControls"
import { WidgetDraftStatus } from "@/components/widgets/WidgetDraftStatus"
import { WidgetManage } from "@/components/widgets/WidgetManage"
import { WidgetPublish } from "@/components/widgets/WidgetPublish"
import { Link, useRouter } from "@/lib/navigation"
import { widgetRequest, type WidgetWorkspace } from "@/lib/widgets/client"

export function WidgetEditor({
  workspace,
  initial,
  mode = "build",
  siteUrl,
}: {
  readonly workspace: WidgetWorkspace
  readonly initial: TeamWidget
  readonly mode?: "build" | "publish" | "manage"
  readonly siteUrl: string
}) {
  const router = useRouter(),
    team = workspace.team,
    state = useWidgetDraft(team.documentId, initial, team.active),
    { widget, draft, phase } = state
  const selection =
    workspace.selections.find((s) => s.documentId === draft.selectionId) ??
    widget.selection
  const resolution = useWidgetResolution(
    team.documentId,
    selection?.spec ?? {
      schemaVersion: 1,
      membership: "fixed",
      sources: [],
      includeLibraryIds: [],
      excludeLibraryIds: [],
      filters: {},
      groups: [],
    },
    draft.config
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState("")
  const action = async (name: string, body: Record<string, unknown> = {}) => {
    setBusy(true)
    setError(null)
    setMessage("")
    try {
      let current = widget
      if (
        !["pause", "unpublish", "archive"].includes(name) &&
        phase !== "saved"
      ) {
        const saved = await state.save()
        if (!saved) {
          setBusy(false)

          return
        }
        current = saved
      }
      const w = await widgetRequest<TeamWidget>(
        team.documentId,
        `/${widget.documentId}/actions/${name}`,
        "POST",
        { version: current.draftVersion, ...body }
      )
      if (name === "archive") {
        router.push("/staff/teams/widgets")
        router.refresh()

        return
      }
      if (name === "duplicate") {
        router.push(`/staff/teams/widgets/${w.documentId}`)
        router.refresh()

        return
      }
      state.adopt(w)
      setMessage(
        name === "publish"
          ? `Version ${w.publishedVersion} published at the same embed address.`
          : name === "review"
            ? "Draft marked ready for organiser review."
            : name === "restore"
              ? "Previous configuration restored to draft. Review and publish it to change the live widget."
              : "Widget updated."
      )
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const go = async (next: string) => {
    if (phase !== "saved" && !(await state.save())) return
    router.push(`/staff/teams/widgets/${widget.documentId}${next}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <WidgetDraftStatus state={state} active={team.active} />
        <nav
          className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto"
          aria-label="Widget steps"
        >
          {(
            [
              ["build", "Build", ""],
              ["publish", "Publish & embed", "/publish"],
              ["manage", "Manage", "/manage"],
            ] as const
          ).map(([key, label, path]) => (
            <Button
              key={key}
              className="min-w-0 px-3 text-[13px] sm:px-6 sm:text-[15px]"
              variant={mode === key ? "primary" : "surface"}
              size="pill"
              disabled={busy || phase === "saving" || phase === "conflict"}
              aria-current={mode === key ? "page" : undefined}
              onClick={() => go(path)}
            >
              {label}
            </Button>
          ))}
        </nav>
      </div>
      <WidgetError error={error ?? state.error} />
      {phase === "conflict" ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="surface" size="pill" onClick={() => state.load()}>
            Load their version
          </Button>
          <Button
            variant="surface"
            size="pill"
            onClick={() => state.load(true)}
          >
            Apply mine on top for review
          </Button>
        </div>
      ) : null}
      {message ? (
        <div role="status">
          <Notice title={message} icon="mdi:check-circle-outline" tone="ok" />
        </div>
      ) : null}
      {!team.active ? (
        <Notice
          tone="warn"
          icon="mdi:pause-circle-outline"
          title="Team inactive — paid tools paused"
        >
          <p>
            Drafts are retained. Organisers can still pause, unpublish or
            archive widgets.
          </p>
          <Link className="font-semibold underline" href="/staff/teams/billing">
            Manage billing and seats
          </Link>
        </Notice>
      ) : null}
      {mode === "publish" ? (
        <WidgetPublish
          key={widget.draftVersion}
          workspace={workspace}
          widget={{ ...widget, selection }}
          resolved={resolution.data}
          resolving={resolution.busy}
          onAction={action}
          busy={busy || phase !== "saved"}
          siteUrl={siteUrl}
        />
      ) : mode === "manage" ? (
        <WidgetManage
          key={widget.draftVersion}
          workspace={workspace}
          widget={widget}
          onAction={action}
          busy={busy || phase !== "saved"}
          siteUrl={siteUrl}
        />
      ) : (
        <WidgetBuilder
          workspace={workspace}
          state={state}
          selection={selection}
          resolution={resolution}
          busy={busy}
          siteUrl={siteUrl}
        />
      )}
    </div>
  )
}
