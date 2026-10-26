"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { EmptyState } from "@/components/ds/EmptyState"
import { Notice } from "@/components/ds/Notice"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  CataloguePicker,
  WidgetError,
} from "@/components/widgets/WidgetControls"
import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
import { Link } from "@/lib/navigation"
import {
  widgetRequest,
  widgetTypeLabels,
  type WidgetWorkspace,
} from "@/lib/widgets/client"

export function WidgetsOverview({
  initial,
}: {
  readonly initial: WidgetWorkspace
}) {
  const [data, setData] = useState(initial),
    [error, setError] = useState<string | null>(null),
    [pendingNetwork, setPendingNetwork] = useState<{
      documentId: string
      name: string
      kind?: string
    } | null>(null),
    [busy, setBusy] = useState(false)
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
        <Badge label="Included with active Team access" color="aurora" />
        <Link
          className={buttonVariants({
            variant: team.active ? "primary" : "surface",
            size: "pill",
          })}
          href="/staff/teams/widgets/new"
        >
          Create widget
        </Link>
      </div>
      <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--t-accent-chip) text-(--t-accent-primary)">
            <Icon aria-hidden icon="mdi:domain" width={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold tracking-wide text-(--t-ink-dim) uppercase">
              Default library source
            </p>
            <h2 className="text-base font-semibold">
              {team.primaryNetwork?.name ?? "Your Team libraries"}
            </h2>
            <p className="mt-1 text-sm text-(--t-ink-dim)">
              New widgets start here. You can choose a different selection for
              each widget.
            </p>
          </div>
          <Badge color="dim" label="Connected" />
        </div>
        {team.organiser && team.active ? (
          <details className="mt-3 pl-0 sm:pl-14">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold text-(--t-accent-primary)">
              Change default source
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-(--t-ink-dim)">
                This chooses public data for new widgets. Management access is
                reviewed separately.
              </p>
              <CataloguePicker
                teamId={team.documentId}
                kind="networks"
                label="Find your library service or network"
                onPick={setPendingNetwork}
              />
              {pendingNetwork ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <strong>{pendingNetwork.name}</strong>
                  <Button
                    variant="primary"
                    size="pill"
                    disabled={busy}
                    onClick={() => connect(pendingNetwork.documentId)}
                  >
                    Confirm default service
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => setPendingNetwork(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
              {team.primaryNetwork ? (
                <Button
                  variant="link"
                  className="mt-3 min-h-11 px-0"
                  disabled={busy}
                  onClick={() => connect(null)}
                >
                  Use manual setup as the default
                </Button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
      <StaffPanel title="Widgets">
        {!data.widgets.length ? (
          <EmptyState
            compact
            lead="Put your library data to work"
            detail="Create a finder, directory, chart or statistic card from the same library selection."
            action={
              team.active ? (
                <Link
                  className={buttonVariants({
                    variant: "primary",
                    size: "pill",
                  })}
                  href="/staff/teams/widgets/new"
                >
                  Create your first widget
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="m-0 list-none space-y-4 p-0">
            {data.widgets.map((w) => (
              <li
                key={w.documentId}
                className="flex flex-wrap items-center gap-5 rounded-2xl border border-(--t-border-line) p-4 sm:p-5"
              >
                <div className="h-24 w-40 shrink-0">
                  <WidgetThumbnail type={w.type} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Link
                    className="text-lg font-semibold text-(--t-ink-base) hover:text-(--t-accent-primary)"
                    href={`/staff/teams/widgets/${w.documentId}`}
                  >
                    {w.name}
                  </Link>
                  <p className="m-0 text-sm text-(--t-ink-dim)">
                    {widgetTypeLabels[w.type]} · “{w.config.title}”
                  </p>
                  <p className="m-0 text-xs text-(--t-ink-dim)">
                    Selection: {w.selection?.name ?? "Selection unavailable"} ·
                    Updated{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(w.updatedAt))}
                  </p>
                  <p className="m-0 text-xs text-(--t-ink-dim)">
                    {w.origins.length
                      ? `Allowed: ${w.origins.join(", ")}`
                      : "No websites added yet"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      color={
                        !team.active
                          ? "warn"
                          : w.state === "live"
                            ? "ok"
                            : "dim"
                      }
                      label={
                        !team.active
                          ? "Unavailable — Team inactive"
                          : w.state === "live"
                            ? `Live v${w.publishedVersion}`
                            : w.state === "draft"
                              ? "Draft only"
                              : w.state
                      }
                    />
                    {w.hasChanges && w.publishedVersion > 0 ? (
                      <Badge color="warn" label="Unpublished changes" />
                    ) : null}
                    {w.reviewRequested ? (
                      <Badge
                        color="aurora"
                        label="Ready for organiser review"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={buttonVariants({
                      variant: "surface",
                      size: "pill",
                    })}
                    href={`/staff/teams/widgets/${w.documentId}`}
                  >
                    Edit
                  </Link>
                  <Link
                    className={buttonVariants({
                      variant: "surface",
                      size: "pill",
                    })}
                    href={`/staff/teams/widgets/${w.documentId}/manage`}
                  >
                    Manage
                  </Link>
                </div>
              </li>
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
          <p className="text-sm text-(--t-ink-dim)">
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
                <div>
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
