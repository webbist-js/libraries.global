"use client"

import {
  parseWidgetOrigins,
  type TeamWidget,
  type WidgetResolved,
} from "@repo/shared-data"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { DiffCard } from "@/components/ds/DiffCard"
import { Notice } from "@/components/ds/Notice"
import {
  StaffPanel,
  STAFF_FIELD,
  STAFF_LINK,
} from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { WidgetError, WidgetField } from "@/components/widgets/WidgetControls"
import {
  widgetEmbedCode,
  widgetTypeLabels,
  type WidgetWorkspace,
} from "@/lib/widgets/client"

export function OriginEditor({
  initial,
  onChange,
  disabled,
}: {
  readonly initial: string[]
  readonly onChange: (values: string[]) => void
  readonly disabled: boolean
}) {
  const [origins, setOrigins] = useState(initial),
    [input, setInput] = useState(""),
    [error, setError] = useState<string | null>(null)
  const change = (next: string[]) => {
    setOrigins(next)
    onChange(next)
  }
  const add = () => {
    try {
      const next = parseWidgetOrigins(
        [...origins, input],
        process.env.NODE_ENV !== "production"
      )
      change(next)
      setInput("")
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {origins.map((o) => (
          <li
            key={o}
            className="flex max-w-full items-center gap-2 rounded-full border border-(--t-border-line) bg-(--t-bg-surface) py-1 pr-2 pl-4 text-sm"
          >
            <span className="truncate">{o}</span>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-full font-semibold"
              disabled={disabled}
              aria-label={`Remove ${o}`}
              onClick={() => change(origins.filter((v) => v !== o))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {!disabled ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <WidgetField
              label="Add an allowed website"
              hint="Use an exact HTTPS origin. Add www and other subdomains separately."
            >
              <input
                className={STAFF_FIELD}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://www.example.org"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    add()
                  }
                }}
              />
            </WidgetField>
          </div>
          <Button
            variant="surface"
            size="pill"
            disabled={!input.trim()}
            onClick={add}
          >
            Add website
          </Button>
        </div>
      ) : null}
      <WidgetError error={error} />
    </div>
  )
}
export function WidgetEmbed({
  widget,
  siteUrl,
}: {
  readonly widget: TeamWidget
  readonly siteUrl: string
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState<string | null>(null),
    code = widgetEmbedCode(
      widget.publicId,
      widget.release?.config ?? widget.config,
      siteUrl
    )
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setError(null)
    } catch {
      setError("Copy isn't available here. Select and copy the code below.")
    }
  }

  return (
    <div className="space-y-5">
      <StaffPanel title="Embed code">
        <p className="mb-4 text-sm text-(--t-ink-dim)">
          The address stays the same across publications. Paste this into an
          HTML or Embed block on your website.
        </p>
        <label className="block">
          <span className="sr-only">Widget iframe code</span>
          <textarea
            readOnly
            className={`${STAFF_FIELD} min-h-52 font-mono text-sm`}
            value={code}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="pill" onClick={copy}>
            {copied ? "Copied" : "Copy embed code"}
          </Button>
          <span role="status" className="text-sm">
            {copied ? "Embed code copied." : ""}
          </span>
          <a
            className={STAFF_LINK}
            href={`${siteUrl}/embed/w/${widget.publicId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open hosted view
          </a>
        </div>
        <WidgetError error={error} />
      </StaffPanel>
      <StaffPanel title="Installing it" compact>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            Add an HTML or Embed block, paste the code and publish your website.
          </li>
          <li>
            Check the actual host origin, including any www prefix, is allowed
            above.
          </li>
          <li>
            The iframe has a fixed fallback height. The optional resize script
            adjusts it to the content.
          </li>
          <li>
            If your site uses Content Security Policy, allow this site&apos;s
            origin in frame-src and, if using the script, script-src.
          </li>
          <li>
            The browser blocks unauthorised frames before they can display a
            notice. Keep the fallback link under the iframe so visitors can open
            the hosted view.
          </li>
        </ol>
      </StaffPanel>
    </div>
  )
}
function libraryCount(count: number) {
  return `${count} ${count === 1 ? "library" : "libraries"}`
}

function recordChecks(widget: TeamWidget, resolved: WidgetResolved | null) {
  return [
    {
      applies: widget.type === "finder",
      label:
        widget.config.mapMode === "map" && !resolved?.diagnostics.mapped
          ? "A map-only finder needs a mapped library. Choose map and list, or list only, to include libraries without coordinates."
          : `${libraryCount(resolved?.diagnostics.missingCoordinates ?? 0)} missing coordinates — retained in lists and counts`,
      tone: resolved?.diagnostics.missingCoordinates ? "warn" : "ok",
      blocks:
        widget.type === "finder" &&
        widget.config.mapMode === "map" &&
        !resolved?.diagnostics.mapped,
    },
    {
      applies:
        (widget.type === "finder" || widget.type === "directory") &&
        widget.config.showHours,
      label: `${libraryCount(resolved?.diagnostics.missingHours ?? 0)} without recorded hours — shown as not recorded`,
      tone: resolved?.diagnostics.missingHours ? "warn" : "ok",
      blocks: false,
    },
  ].filter((check) => check.applies)
}
function publicationChecks(
  widget: TeamWidget,
  resolved: WidgetResolved | null,
  resolving: boolean,
  active: boolean
) {
  const checks = [
    {
      label: resolving
        ? "Checking published library data…"
        : resolved
          ? `${resolved.diagnostics.selected} published libraries resolved`
          : "Library data is unavailable",
      tone: resolved && !resolving ? "ok" : "warn",
      blocks: !resolved || resolving,
    },
    {
      label: resolved?.diagnostics.selected
        ? "The selection contains public records"
        : "Choose at least one published library",
      tone: resolved?.diagnostics.selected ? "ok" : "warn",
      blocks: !resolved?.diagnostics.selected,
    },
    {
      label: resolved?.diagnostics.licenceIssues.length
        ? "Some source redistribution permissions need review"
        : "Data attribution and source credits are included",
      tone: resolved?.diagnostics.licenceIssues.length ? "warn" : "ok",
      blocks: Boolean(resolved?.diagnostics.licenceIssues.length),
    },
    ...recordChecks(widget, resolved),
    {
      label:
        widget.selection?.spec.membership === "follow_sources"
          ? "Follows source membership. Public libraries can appear without republishing; staff authority remains separately reviewed."
          : "Fixed library identities, with current published facts.",
      tone: "info",
      blocks: false,
    },
    {
      label: active
        ? "Team access is active"
        : "An active Team is required to publish",
      tone: active ? "ok" : "warn",
      blocks: !active,
    },
  ]

  return checks
}

function formatSetting(value: unknown) {
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (value === "") return "Not set"

  return String(value).replace(/^./, (letter) => letter.toUpperCase())
}

export function WidgetPublish({
  workspace,
  widget,
  resolved,
  resolving,
  onAction,
  busy,
  siteUrl,
}: {
  readonly workspace: WidgetWorkspace
  readonly widget: TeamWidget
  readonly resolved: WidgetResolved | null
  readonly resolving: boolean
  readonly onAction: (
    action: string,
    body?: Record<string, unknown>
  ) => Promise<void>
  readonly busy: boolean
  readonly siteUrl: string
}) {
  const [origins, setOrigins] = useState(widget.origins),
    team = workspace.team
  const checks = publicationChecks(widget, resolved, resolving, team.active)
  const live = widget.release
  const differences = live
    ? [
        ...Object.keys(widget.config)
          .filter(
            (k) =>
              JSON.stringify(live.config[k as keyof typeof live.config]) !==
              JSON.stringify(widget.config[k as keyof typeof widget.config])
          )
          .map((k) => ({
            label:
              (
                {
                  hidePowered: "Hide Libraries Global branding",
                  showHours: "Opening information",
                  showAccess: "Accessibility information",
                  showLinks: "Links to library records",
                  showPublisher: "Publishing organisation",
                  description: "Accessible description",
                  mapMode: "Map presentation",
                  chartMode: "Chart values",
                  locale: "Content language",
                  pageSize: "Libraries per page",
                  facility: "Recorded feature",
                  valueLabels: "Chart value labels",
                  showTable: "Data table",
                  locate: "Use my location",
                  facilityFilter: "Step-free filter",
                } as Record<string, string>
              )[k] ??
              k
                .replaceAll(/([A-Z])/g, " $1")
                .replace(/^./, (letter) => letter.toUpperCase()),
            now: formatSetting(live.config[k as keyof typeof live.config]),
            suggested: formatSetting(
              widget.config[k as keyof typeof widget.config]
            ),
          })),
        ...(live.type !== widget.type
          ? [
              {
                label: "Widget type",
                now: widgetTypeLabels[live.type],
                suggested: widgetTypeLabels[widget.type],
              },
            ]
          : []),
        ...(JSON.stringify(live.spec) !== JSON.stringify(widget.selection?.spec)
          ? [
              {
                label: "Library selection",
                now: `${live.selectionName} · v${live.selectionVersion}`,
                suggested: `${widget.selection?.name} · v${widget.selection?.version}`,
              },
            ]
          : []),
      ]
    : []
  const blocked = checks.some((c) => c.blocks) || !origins.length || busy

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <StaffPanel title="Publication checks">
          <ul className="m-0 list-none space-y-3 p-0">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3 text-sm">
                <Badge
                  color={
                    c.tone === "ok"
                      ? "ok"
                      : c.tone === "info"
                        ? "aurora"
                        : "warn"
                  }
                  label={
                    c.blocks
                      ? "Blocking"
                      : c.tone === "ok"
                        ? "Pass"
                        : c.tone === "info"
                          ? "Info"
                          : "Warning"
                  }
                  size="xs"
                />
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </StaffPanel>
        <StaffPanel title="What changes">
          {!live ? (
            <p>
              This is the first publication. It will create a stable public
              embed address.
            </p>
          ) : differences.length ? (
            <DiffCard
              title={`Live v${live.version} → next publication`}
              rows={differences}
              byline="Compare the current publication with the saved draft"
              actions={null}
            />
          ) : (
            <p>
              No configuration changes. Publishing refreshes the release and
              resumes a paused widget.
            </p>
          )}
        </StaffPanel>
      </div>
      <StaffPanel title="Allowed websites">
        <p className="mb-4 text-sm text-(--t-ink-dim)">
          The hosted view can be opened directly. Framing is limited to these
          exact origins; removing an origin takes effect on the next load.
        </p>
        {!origins.length ? (
          <p
            role="status"
            className="mb-4 rounded-xl bg-(--t-bg-surface) p-3 text-sm"
          >
            Add the website where this widget will be embedded to enable
            publication.
          </p>
        ) : null}
        <OriginEditor
          initial={widget.origins}
          onChange={setOrigins}
          disabled={!team.organiser || !team.active || busy}
        />
      </StaffPanel>
      {!team.organiser ? (
        <Notice
          title="Ready for organiser review"
          tone="info"
          icon="mdi:account-check-outline"
        >
          <p>
            Members can edit drafts. An organiser publishes and controls allowed
            websites.
          </p>
          <Button
            variant="primary"
            size="pill"
            disabled={busy || !team.active}
            onClick={() => onAction("review")}
          >
            {widget.reviewRequested
              ? "Review requested"
              : "Ready for organiser review"}
          </Button>
        </Notice>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm">
            Publishing creates v{widget.publishedVersion + 1} at the same
            address. Earlier configurations remain in history.
          </p>
          <Button
            variant="primary"
            size="pill"
            disabled={blocked}
            onClick={() => onAction("publish", { origins })}
          >
            {busy
              ? "Publishing…"
              : `Publish version ${widget.publishedVersion + 1}`}
          </Button>
        </div>
      )}
      {widget.publishedVersion > 0 ? (
        <WidgetEmbed widget={widget} siteUrl={siteUrl} />
      ) : null}
    </div>
  )
}
