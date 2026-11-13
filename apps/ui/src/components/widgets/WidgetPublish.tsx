"use client"
import {
  parseWidgetOrigins,
  type TeamWidget,
  type WidgetResolved,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
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
import { widgetEmbedCode, type WidgetWorkspace } from "@/lib/widgets/client"

export function OriginEditor({
  initial,
  onChange,
  disabled,
}: {
  readonly initial: string[]
  readonly onChange: (values: string[]) => void
  readonly disabled: boolean
}) {
  const tStatic = useTranslations("staticUi")

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
              label={tStatic("widget.add_an_allowed_website")}
              hint={tStatic(
                "widget.use_an_exact_https_origin_add_www_and_other_subdomains_separately"
              )}
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
            {tStatic("widget.add_website")}
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
  const tSettings = useTranslations("widgetSettings")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
      setError(tSettings("copyUnavailable"))
    }
  }

  return (
    <div className="space-y-5">
      <StaffPanel title={tStatic("widget.embed_code")}>
        <p className="mb-4 text-sm text-(--t-ink-dim)">
          {tStatic(
            "widget.the_address_stays_the_same_across_publications_paste_this_into_an_html_or_embed_block_on_your_website"
          )}
        </p>
        <label className="block">
          <span className="sr-only">
            {tStatic("widget.widget_iframe_code")}
          </span>
          <textarea
            readOnly
            className={`${STAFF_FIELD} min-h-52 font-mono text-sm`}
            value={code}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="pill" onClick={copy}>
            {copied ? tExisting("ui.copied") : "Copy embed code"}
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
            {tStatic("widget.open_hosted_view")}
          </a>
        </div>
        <WidgetError error={error} />
      </StaffPanel>
      <StaffPanel title={tStatic("widget.installing_it")} compact>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            {tStatic(
              "widget.add_an_html_or_embed_block_paste_the_code_and_publish_your_website"
            )}
          </li>
          <li>
            {tStatic(
              "widget.check_the_actual_host_origin_including_any_www_prefix_is_allowed_above"
            )}
          </li>
          <li>
            {tStatic(
              "widget.the_iframe_has_a_fixed_fallback_height_the_optional_resize_script_adjusts_it_to_the_content"
            )}
          </li>
          <li>
            {tStatic(
              "widget.if_your_site_uses_content_security_policy_allow_this_site_apos_s_origin_in_frame_src_and_if_using_the_script_s"
            )}
          </li>
          <li>
            {tStatic(
              "widget.the_browser_blocks_unauthorised_frames_before_they_can_display_a_notice_keep_the_fallback_link_under_the_ifram"
            )}
          </li>
        </ol>
      </StaffPanel>
    </div>
  )
}
function recordChecks(
  widget: TeamWidget,
  resolved: WidgetResolved | null,
  tSettings: ReturnType<typeof useTranslations<"widgetSettings">>
) {
  return [
    {
      applies: widget.type === "finder",
      label:
        widget.config.mapMode === "map" && !resolved?.diagnostics.mapped
          ? tSettings("mapRequired")
          : tSettings("missingCoordinatesCount", {
              count: resolved?.diagnostics.missingCoordinates ?? 0,
            }),
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
      label: tSettings("missingHoursCount", {
        count: resolved?.diagnostics.missingHours ?? 0,
      }),
      tone: resolved?.diagnostics.missingHours ? "warn" : "ok",
      blocks: false,
    },
  ].filter((check) => check.applies)
}
function publicationChecks(
  widget: TeamWidget,
  resolved: WidgetResolved | null,
  resolving: boolean,
  active: boolean,
  tSettings: ReturnType<typeof useTranslations<"widgetSettings">>
) {
  const checks = [
    {
      label: resolving
        ? tSettings("checking")
        : resolved
          ? tSettings("resolved", { count: resolved.diagnostics.selected })
          : tSettings("unavailable"),
      tone: resolved && !resolving ? "ok" : "warn",
      blocks: !resolved || resolving,
    },
    {
      label: resolved?.diagnostics.selected
        ? tSettings("publicRecords")
        : tSettings("chooseLibrary"),
      tone: resolved?.diagnostics.selected ? "ok" : "warn",
      blocks: !resolved?.diagnostics.selected,
    },
    {
      label: resolved?.diagnostics.licenceIssues.length
        ? tSettings("licenceReview")
        : tSettings("creditsIncluded"),
      tone: resolved?.diagnostics.licenceIssues.length ? "warn" : "ok",
      blocks: Boolean(resolved?.diagnostics.licenceIssues.length),
    },
    ...recordChecks(widget, resolved, tSettings),
    {
      label:
        widget.selection?.spec.membership === "follow_sources"
          ? tSettings("followsSources")
          : tSettings("fixedLibraries"),
      tone: "info",
      blocks: false,
    },
    {
      label: active
        ? tSettings("workspaceOpen")
        : tSettings("publishingPaused"),
      tone: active ? "ok" : "warn",
      blocks: !active,
    },
  ]

  return checks
}

function formatSetting(
  value: unknown,
  tSettings: ReturnType<typeof useTranslations<"widgetSettings">>
) {
  if (typeof value === "boolean")
    return value ? tSettings("on") : tSettings("off")
  if (value === "") return tSettings("notSet")

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
  const tSettings = useTranslations("widgetSettings")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [origins, setOrigins] = useState(widget.origins),
    team = workspace.team
  const checks = publicationChecks(
    widget,
    resolved,
    resolving,
    team.active,
    tSettings
  )
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
                  description: tStatic("widget.accessible_description"),
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
            now: formatSetting(
              live.config[k as keyof typeof live.config],
              tSettings
            ),
            suggested: formatSetting(
              widget.config[k as keyof typeof widget.config],
              tSettings
            ),
          })),
        ...(live.type !== widget.type
          ? [
              {
                label: tStatic("widget.widget_type"),
                now: tSettings(live.type),
                suggested: tSettings(widget.type),
              },
            ]
          : []),
        ...(JSON.stringify(live.spec) !== JSON.stringify(widget.selection?.spec)
          ? [
              {
                label: tStatic("common.librarySelection"),
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
        <StaffPanel title={tStatic("widget.publication_checks")}>
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
                      ? tSettings("blocking")
                      : c.tone === "ok"
                        ? tSettings("pass")
                        : c.tone === "info"
                          ? tSettings("info")
                          : tSettings("warning")
                  }
                  size="xs"
                />
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </StaffPanel>
        <StaffPanel title={tStatic("widget.what_changes")}>
          {!live ? (
            <p>
              {tStatic(
                "widget.this_is_the_first_publication_it_will_create_a_stable_public_embed_address"
              )}
            </p>
          ) : differences.length ? (
            <DiffCard
              title={tSettings("compareTitle", { version: live.version })}
              rows={differences}
              byline={tSettings("compareByline")}
              actions={null}
            />
          ) : (
            <p>
              {tStatic(
                "widget.no_configuration_changes_publishing_refreshes_the_release_and_resumes_a_paused_widget"
              )}
            </p>
          )}
        </StaffPanel>
      </div>
      <StaffPanel title={tStatic("widget.allowed_websites")}>
        <p className="mb-4 text-sm text-(--t-ink-dim)">
          {tStatic(
            "widget.the_hosted_view_can_be_opened_directly_framing_is_limited_to_these_exact_origins_removing_an_origin_takes_effe"
          )}
        </p>
        {!origins.length ? (
          <p
            role="status"
            className="mb-4 rounded-xl bg-(--t-bg-surface) p-3 text-sm"
          >
            {tStatic(
              "widget.add_the_website_where_this_widget_will_be_embedded_to_enable_publication"
            )}
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
          title={tStatic("widget.ready_for_organiser_review")}
          tone="info"
          icon="mdi:account-check-outline"
        >
          <p>
            {tStatic(
              "widget.members_can_edit_drafts_an_organiser_publishes_and_controls_allowed_websites"
            )}
          </p>
          <Button
            variant="primary"
            size="pill"
            disabled={busy || !team.active}
            onClick={() => onAction("review")}
          >
            {widget.reviewRequested
              ? "Review requested"
              : tStatic("widget.ready_for_organiser_review")}
          </Button>
        </Notice>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm">
            {tStatic("widget.publicationNote", {
              version: widget.publishedVersion + 1,
            })}
          </p>
          <Button
            variant="primary"
            size="pill"
            disabled={blocked}
            onClick={() => onAction("publish", { origins })}
          >
            {busy
              ? tExisting("sharedControls.publish.busy")
              : tStatic("widget.publishVersion", {
                  version: widget.publishedVersion + 1,
                })}
          </Button>
        </div>
      )}
      {widget.publishedVersion > 0 ? (
        <WidgetEmbed widget={widget} siteUrl={siteUrl} />
      ) : null}
    </div>
  )
}
