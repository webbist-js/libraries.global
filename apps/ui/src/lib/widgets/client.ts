import type {
  TeamWidget,
  WidgetConfig,
  WidgetWorkspace,
} from "@repo/shared-data"

const knownErrors = new Set([
  "version_conflict",
  "team_inactive",
  "organiser_required",
  "selection_too_large",
  "workspace_limit",
  "source_licence_unavailable",
  "branding_required",
  "website_required",
  "empty_selection",
  "no_mapped_libraries",
  "network_unavailable",
  "not_found",
  "unavailable",
  "selection_unavailable",
  "no_assignments",
])

export class WidgetRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string
  ) {
    super(knownErrors.has(code) ? code : (message ?? "unavailable"))
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
export type { WidgetWorkspace }
