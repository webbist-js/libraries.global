import type {
  TeamWidget,
  WidgetConfig,
  WidgetWorkspace,
} from "@repo/shared-data"

const messages: Record<string, string> = {
  version_conflict:
    "Another editor changed this draft. Load their version or apply your changes on top.",
  team_inactive:
    "Your Team is inactive. An organiser can still pause, unpublish or archive widgets.",
  organiser_required: "Only a Team organiser can do this.",
  selection_too_large:
    "This selection exceeds the 2,000-library engineering limit. Narrow the source or filters.",
  workspace_limit:
    "This workspace has reached its engineering storage limit. Contact Libraries Global.",
  source_licence_unavailable:
    "Source redistribution permissions need review before this widget can be published.",
  branding_required:
    "Hiding the publisher credit requires the Widget branding add-on.",
  website_required: "Add at least one allowed website.",
  empty_selection: "Select at least one published library.",
  no_mapped_libraries:
    "No selected libraries have coordinates. Use a list or add mapped libraries.",
  network_unavailable: "That network is unavailable. Choose another source.",
  not_found: "This record is unavailable or you no longer have access.",
}

export class WidgetRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string
  ) {
    super(
      message ??
        messages[code] ??
        "The widget service could not complete this request. Please retry."
    )
  }
}
export async function widgetRequest<T>(
  teamId: string,
  path = "",
  method = "GET",
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/staff/team/${teamId}/widgets${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new WidgetRequestError("unavailable", 503)
  }
  const value = await response.json().catch(() => null)
  if (!response.ok) {
    const e = value?.error
    throw new WidgetRequestError(
      e?.code ?? "unavailable",
      response.status,
      e?.message
    )
  }

  return value as T
}
export const widgetDraft = (widget: TeamWidget) => ({
  name: widget.name,
  type: widget.type,
  config: widget.config,
  selectionId: widget.selection?.documentId ?? "",
})
export type WidgetDraft = ReturnType<typeof widgetDraft>
const escapeWidgetAttribute = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

export function widgetEmbedCode(
  publicId: string,
  config: WidgetConfig,
  siteUrl: string
) {
  return `<iframe src="${escapeWidgetAttribute(siteUrl)}/embed/w/${publicId}"\n  title="${escapeWidgetAttribute(config.title)}"\n  width="100%" height="${config.height}"\n  style="border:0;max-width:100%"\n  loading="lazy" data-lg-widget="${publicId}"${config.locate ? ' allow="geolocation"' : ""}></iframe>\n<script src="${escapeWidgetAttribute(siteUrl)}/embed/resize.js" async></script>\n<p><a href="${escapeWidgetAttribute(siteUrl)}/embed/w/${publicId}" target="_blank" rel="noopener noreferrer">View this library widget</a></p>`
}
export type CatalogueOption = {
  documentId: string
  name: string
  kind?: string
  city?: string
  libraryCount?: number
}
export type CataloguePage = {
  rows: CatalogueOption[]
  more: boolean
  page: number
}
export const widgetTypeLabels = {
  finder: "Library finder",
  directory: "Directory",
  chart: "Comparison chart",
  stat: "Statistic card",
}
export type { WidgetWorkspace }
