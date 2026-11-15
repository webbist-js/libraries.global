"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
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
import { widgetRequest, type WidgetWorkspace } from "@/lib/widgets/client"

const WIDGET_STATUS_STYLE = {
  maxWidth: "100%",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
} as const

/** The widget's main status chip: inactive Team, live version or draft. */
function widgetStatus(
  w: WidgetWorkspace["widgets"][number],
  teamActive: boolean,
  tSettings: ReturnType<typeof useTranslations<"widgetSettings">>
): { color: "warn" | "ok" | "dim"; label: string } {
  if (!teamActive) return { color: "warn", label: tSettings("closed") }
  if (w.state === "live")
    return {
      color: "ok",
      label: tSettings("live", { version: w.publishedVersion ?? 0 }),
    }

  return {
    color: "dim",
    label: tSettings(
      w.state === "draft"
        ? "draft"
        : w.state === "paused"
          ? "paused"
          : "archived"
    ),
  }
}

/** One widget's card in the overview grid. */
function WidgetCard({
  w,
  teamActive,
}: {
  readonly w: WidgetWorkspace["widgets"][number]
  readonly teamActive: boolean
}) {
  const tSettings = useTranslations("widgetSettings")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
          <Badge
            style={WIDGET_STATUS_STYLE}
            {...widgetStatus(w, teamActive, tSettings)}
          />
          {w.hasChanges && w.publishedVersion > 0 ? (
            <Badge
              color="warn"
              label={tStatic("widget.unpublished_changes")}
              style={WIDGET_STATUS_STYLE}
            />
          ) : null}
          {w.reviewRequested ? (
            <Badge
              style={WIDGET_STATUS_STYLE}
              color="aurora"
              label={tStatic("widget.ready_for_organiser_review")}
            />
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 wrap-anywhere">
        <div className="min-w-0">
          <p className="type-label m-0 text-(--t-accent-primary)">
            {tSettings(w.type)}
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
              <span className="sr-only">{tStatic("widget.selection")} </span>
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
            <span>
              {tExisting("editorial.updated")} {updated}
            </span>
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-(--t-border-line) px-5 py-4">
        <Link className={cn(primaryCtaSm, "min-h-11 max-w-full")} href={href}>
          {tStatic("widget.edit_widget")}
        </Link>
        <Link
          className={cn(secondaryCtaSm, "min-h-11 max-w-full")}
          href={`${href}/manage`}
        >
          {tStatic("widget.publishing_websites")}
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  return (
    <div
      id="widget-default-source-change"
      className="grid gap-4 border-t border-(--t-border-line) p-5 sm:pl-20"
    >
      <div className="max-w-xl">
        <CataloguePicker
          teamId={teamId}
          kind="networks"
          label={tStatic("widget.find_your_library_service_or_network")}
          onPick={onPick}
        />
        <p className="m-0 mt-2 text-sm leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "widget.uses_public_library_data_management_access_to_a_service_is_reviewed_separately"
          )}
        </p>
      </div>
      {pendingNetwork ? (
        <div className="flex max-w-xl flex-wrap items-center gap-3 rounded-xl bg-(--t-bg-surface) p-4">
          <p className="m-0 min-w-0 flex-1 text-base">
            {tStatic.rich("widget.useDefault", {
              name: pendingNetwork.name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPick(null)}
              className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
            >
              {tExisting("ui.cancel")}
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
              {tStatic("common.confirm")}
            </button>
          </div>
        </div>
      ) : null}
      {hasPrimaryNetwork ? (
        <p className="m-0 text-sm text-(--t-ink-dim)">
          {tStatic("widget.no_single_service_fits")}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => onConnect(null)}
            className="cursor-pointer font-semibold text-(--t-accent-primary) underline underline-offset-4 disabled:opacity-50"
          >
            {tStatic("widget.use_manual_setup_instead")}
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
          title={tStatic("widget.your_workspace_is_closed")}
        >
          <p>
            {tStatic(
              "widget.published_widgets_are_unavailable_an_organiser_can_still_pause_unpublish_or_archive_retained_work"
            )}
          </p>
          <Link href="/contact" className="font-semibold underline">
            {tStatic("common.contactSiteTeam")}
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
              {tStatic("widget.default_library_source")}
            </p>
            <h2
              id="widget-default-source"
              className="m-0 text-lg leading-snug font-semibold wrap-anywhere"
            >
              {team.primaryNetwork?.name ?? "Your Team libraries"}
            </h2>
            <p className="m-0 mt-0.5 text-sm text-(--t-ink-dim)">
              {tStatic(
                "widget.new_widgets_start_from_this_source_each_widget_can_use_its_own_selection"
              )}
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
              {changingSource
                ? tExisting("ui.done")
                : tExisting("atlasNetwork.changeService")}
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
      <StaffPanel
        title={tExisting("staffWorkspace.widgets")}
        className="@container/widgets"
      >
        {!data.widgets.length ? (
          <EmptyState
            compact
            lead={tStatic("widget.put_your_library_data_to_work")}
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
        title={tStatic("widget.library_selections")}
        aside={
          team.active ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
              href="/staff/teams/widgets/selections/new"
            >
              {tStatic("widget.create_selection")}
            </Link>
          ) : undefined
        }
      >
        {!data.selections.length ? (
          <p className="m-0 max-w-prose text-sm leading-relaxed text-(--t-ink-dim)">
            {tStatic(
              "widget.selections_are_saved_separately_so_a_map_directory_and_chart_can_use_the_same_libraries"
            )}
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
                      ? tStatic("widget.fixedMembership")
                      : tStatic("widget.followMembership")}{" "}
                    ·{" "}
                    {tStatic("widget.usedBy", { count: s.usedBy?.length ?? 0 })}
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
                  {tStatic("widget.edit_selection")}
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
