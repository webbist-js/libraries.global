"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { EmptyState } from "@/components/ds/EmptyState"
import { Notice } from "@/components/ds/Notice"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { primaryCtaSm, secondaryCtaSm } from "@/components/ui/action-styles"
import { buttonVariants } from "@/components/ui/button"
import {
  CataloguePicker,
  WidgetError,
} from "@/components/widgets/WidgetControls"
import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"
import {
  widgetRequest,
  widgetTypeLabels,
  type WidgetWorkspace,
} from "@/lib/widgets/client"

const WIDGET_STATUS_STYLE = {
  maxWidth: "100%",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
} as const

/** The widget's main status chip: inactive Team, live version or draft. */
function widgetStatus(
  w: WidgetWorkspace["widgets"][number],
  teamActive: boolean
): { color: "warn" | "ok" | "dim"; label: string } {
  if (!teamActive)
    return { color: "warn", label: "Unavailable — Team inactive" }
  if (w.state === "live")
    return { color: "ok", label: `Live v${w.publishedVersion}` }

  return { color: "dim", label: w.state === "draft" ? "Draft only" : w.state }
}

/** One widget's card in the overview grid. */
function WidgetCard({
  w,
  teamActive,
}: {
  readonly w: WidgetWorkspace["widgets"][number]
  readonly teamActive: boolean
}) {
  const href = `/staff/teams/widgets/${w.documentId}`
  const updated = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(w.updatedAt))

  return (
    <li className="flex min-w-0 flex-col overflow-clip rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep)">
      <div className="relative flex items-center justify-center bg-(--t-bg-surface) px-5 pt-10 pb-5">
        <div className="h-24 w-44 max-w-full">
          <WidgetThumbnail type={w.type} />
        </div>
        <div className="absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
          <Badge style={WIDGET_STATUS_STYLE} {...widgetStatus(w, teamActive)} />
          {w.hasChanges && w.publishedVersion > 0 ? (
            <Badge
              color="warn"
              label="Unpublished changes"
              style={WIDGET_STATUS_STYLE}
            />
          ) : null}
          {w.reviewRequested ? (
            <Badge
              style={WIDGET_STATUS_STYLE}
              color="aurora"
              label="Ready for organiser review"
            />
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 wrap-anywhere">
        <div className="min-w-0">
          <p className="type-label m-0 text-(--t-accent-primary)">
            {widgetTypeLabels[w.type]}
          </p>
          <h3 className="m-0 mt-1 text-lg leading-snug font-semibold">
            <Link
              className="text-(--t-ink-base) no-underline hover:text-(--t-accent-primary) hover:underline"
              href={href}
            >
              {w.name}
            </Link>
          </h3>
          <p className="m-0 mt-1 text-sm text-(--t-ink-dim)">
            “{w.config.title}”
          </p>
        </div>
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm text-(--t-ink-dim)">
          <li className="flex items-start gap-2">
            <Icon
              aria-hidden
              icon="mdi:map-marker-multiple-outline"
              width={16}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="sr-only">Selection: </span>
              {w.selection?.name ?? "Selection unavailable"}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon
              aria-hidden
              icon="mdi:web"
              width={16}
              className="mt-0.5 shrink-0"
            />
            <span>
              {w.origins.length
                ? `Allowed on ${w.origins.join(", ")}`
                : "No websites added yet"}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon
              aria-hidden
              icon="mdi:clock-outline"
              width={16}
              className="mt-0.5 shrink-0"
            />
            <span>Updated {updated}</span>
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-(--t-border-line) px-5 py-4">
        <Link className={cn(primaryCtaSm, "min-h-11 max-w-full")} href={href}>
          Edit widget
        </Link>
        <Link
          className={cn(secondaryCtaSm, "min-h-11 max-w-full")}
          href={`${href}/manage`}
        >
          Publishing & websites
        </Link>
      </div>
    </li>
  )
}

type PendingNetwork = { documentId: string; name: string; kind?: string }

/** The organiser's picker for a new default source, with confirmation. */
function DefaultSourceChange({
  teamId,
  hasPrimaryNetwork,
  busy,
  pendingNetwork,
  onPick,
  onConnect,
}: {
  readonly teamId: string
  readonly hasPrimaryNetwork: boolean
  readonly busy: boolean
  readonly pendingNetwork: PendingNetwork | null
  readonly onPick: (network: PendingNetwork | null) => void
  readonly onConnect: (id: string | null) => void
}) {
  return (
    <div
      id="widget-default-source-change"
      className="grid gap-4 border-t border-(--t-border-line) p-5 sm:pl-20"
    >
      <div className="max-w-xl">
        <CataloguePicker
          teamId={teamId}
          kind="networks"
          label="Find your library service or network"
          onPick={onPick}
        />
        <p className="m-0 mt-2 text-sm leading-relaxed text-(--t-ink-dim)">
          Uses public library data. Management access to a service is reviewed
          separately.
        </p>
      </div>
      {pendingNetwork ? (
        <div className="flex max-w-xl flex-wrap items-center gap-3 rounded-xl bg-(--t-bg-surface) p-4">
          <p className="m-0 min-w-0 flex-1 text-base">
            Use <strong>{pendingNetwork.name}</strong> as the default?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPick(null)}
              className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onConnect(pendingNetwork.documentId)}
              className={cn(
                primaryCtaSm,
                "min-h-11 cursor-pointer disabled:opacity-50"
              )}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}
      {hasPrimaryNetwork ? (
        <p className="m-0 text-sm text-(--t-ink-dim)">
          No single service fits?{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => onConnect(null)}
            className="cursor-pointer font-semibold text-(--t-accent-primary) underline underline-offset-4 disabled:opacity-50"
          >
            Use manual setup instead
          </button>
        </p>
      ) : null}
    </div>
  )
}

export function WidgetsOverview({
  initial,
}: {
  readonly initial: WidgetWorkspace
}) {
  const [data, setData] = useState(initial),
    [error, setError] = useState<string | null>(null),
    [pendingNetwork, setPendingNetwork] = useState<PendingNetwork | null>(null),
    [busy, setBusy] = useState(false),
    [changingSource, setChangingSource] = useState(false)
  const team = data.team
  const connect = async (id: string | null) => {
    setBusy(true)
    setError(null)
    try {
      await widgetRequest(team.documentId, "/network", "PUT", {
        documentId: id,
      })
      setData(await widgetRequest(team.documentId))
      setPendingNetwork(null)
      setChangingSource(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-7">
      <WidgetError error={error} />
      {!team.active ? (
        <Notice
          icon="mdi:pause-circle-outline"
          tone="warn"
          title="Your Team is inactive"
        >
          <p>
            Published widgets are unavailable. An organiser can manage billing,
            pause, unpublish or archive retained work.
          </p>
          <Link href="/staff/teams/billing" className="font-semibold underline">
            Manage billing and seats
          </Link>
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 text-(--t-ink-dim)">
          {data.widgets.length}{" "}
          {data.widgets.length === 1 ? "widget" : "widgets"} ·{" "}
          {data.selections.length} reusable{" "}
          {data.selections.length === 1 ? "selection" : "selections"}
        </p>
      </div>
      <section
        aria-labelledby="widget-default-source"
        className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep)"
      >
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--t-accent-chip) text-(--t-accent-primary)">
            <Icon aria-hidden icon="mdi:domain" width={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-label m-0 text-(--t-ink-dim)">
              Default library source
            </p>
            <h2
              id="widget-default-source"
              className="m-0 text-lg leading-snug font-semibold wrap-anywhere"
            >
              {team.primaryNetwork?.name ?? "Your Team libraries"}
            </h2>
            <p className="m-0 mt-0.5 text-sm text-(--t-ink-dim)">
              New widgets start from this source. Each widget can use its own
              selection.
            </p>
          </div>
          {team.organiser && team.active ? (
            <button
              type="button"
              aria-expanded={changingSource}
              aria-controls="widget-default-source-change"
              onClick={() => {
                setChangingSource((open) => !open)
                setPendingNetwork(null)
              }}
              className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
            >
              {changingSource ? "Done" : "Change"}
            </button>
          ) : null}
        </div>
        {team.organiser && team.active && changingSource ? (
          <DefaultSourceChange
            teamId={team.documentId}
            hasPrimaryNetwork={Boolean(team.primaryNetwork)}
            busy={busy}
            pendingNetwork={pendingNetwork}
            onPick={setPendingNetwork}
            onConnect={(id) => void connect(id)}
          />
        ) : null}
      </section>
      <StaffPanel title="Widgets" className="@container/widgets">
        {!data.widgets.length ? (
          <EmptyState
            compact
            lead="Put your library data to work"
            detail="Create a finder, directory, chart or statistic card from the same library selection."
          />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 @min-[880px]/widgets:grid-cols-2">
            {data.widgets.map((w) => (
              <WidgetCard key={w.documentId} w={w} teamActive={team.active} />
            ))}
          </ul>
        )}
      </StaffPanel>
      <StaffPanel
        title="Library selections"
        aside={
          team.active ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
              href="/staff/teams/widgets/selections/new"
            >
              Create selection
            </Link>
          ) : undefined
        }
      >
        {!data.selections.length ? (
          <p className="m-0 max-w-prose text-sm leading-relaxed text-(--t-ink-dim)">
            Selections are saved separately so a map, directory and chart can
            use the same libraries.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
            {data.selections.map((s) => (
              <li
                key={s.documentId}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="max-w-full min-w-0 wrap-anywhere">
                  <Link
                    className="font-semibold text-(--t-accent-primary) underline"
                    href={`/staff/teams/widgets/selections/${s.documentId}`}
                  >
                    {s.name}
                  </Link>
                  <p className="mt-1 text-sm text-(--t-ink-dim)">
                    {" "}
                    {s.spec.membership === "fixed"
                      ? "Fixed library identities"
                      : "Follows source membership"}{" "}
                    · Used by {s.usedBy?.length ?? 0}{" "}
                    {(s.usedBy?.length ?? 0) === 1 ? "widget" : "widgets"}
                  </p>
                </div>
                <Link
                  className={buttonVariants({
                    variant: "surface",
                    size: "pill",
                    className: "max-w-full",
                  })}
                  href={`/staff/teams/widgets/selections/${s.documentId}`}
                >
                  Edit selection
                  <Icon aria-hidden icon="mdi:arrow-right" width={17} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StaffPanel>
    </div>
  )
}
