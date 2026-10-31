import type { WidgetPresentationData } from "@/components/widgets/presentation"
import type { WidgetDraftStatus } from "@/components/widgets/WidgetDraftStatus"
import { defaultWidgetConfig } from "@repo/shared-data"
import type { ComponentProps } from "react"
import { fn } from "storybook/test"

import { widgetWorkspace } from "../widgets"

export { widgetWorkspace }
export const widget = widgetWorkspace.widgets[0]!
export const selection = widgetWorkspace.selections[0]!
export const widgetData: WidgetPresentationData = {
  type: "directory",
  config: {
    ...defaultWidgetConfig(),
    title: "Libraries in Northbridge",
    introduction: "Find a welcoming place to read, study and explore.",
    mapMode: "list",
  },
  spec: selection.spec,
  publisher: "Example Library Team",
  rows: [
    {
      documentId: "example-library",
      name: "Northbridge Community Library",
      href: "/libraries/northbridge",
      city: "Northbridge",
      address: "1 Example Square",
      libraryType: "Public",
      country: "Example country",
      location: { lat: 51.5, lng: -0.1 },
      hours: ["Monday to Friday, 09:00–17:00"],
      operationalStatus: "open",
      facilities: ["yes", "no", "unknown"],
      why: ["Managed by Example Library Team"],
      locale: "en",
      updatedAt: "2026-01-15T12:00:00Z",
    },
  ],
  diagnostics: {
    selected: 1,
    mapped: 1,
    missingCoordinates: 0,
    unresolvedIds: [],
    excludedIds: [],
    missingHours: 0,
    licenceIssues: [],
  },
  attribution: [],
  checkedAt: "2026-01-15T12:00:00Z",
}
export const widgetState: ComponentProps<typeof WidgetDraftStatus>["state"] = {
  widget,
  draft: {
    name: widget.name,
    type: widget.type,
    config: widget.config,
    selectionId: selection.documentId,
  },
  edit: fn(),
  adopt: fn(),
  phase: "saved",
  error: null,
  save: fn(async () => widget),
  load: fn(async () => {}),
}

export const widgetResponses = {
  "POST /api/staff/team/example-team/widgets/preview": {
    body: {
      rows: widgetData.rows,
      diagnostics: widgetData.diagnostics,
      attribution: widgetData.attribution,
      checkedAt: widgetData.checkedAt,
    },
  },
  "GET /api/staff/team/example-team/widgets/catalogue": {
    body: {
      rows: [
        {
          documentId: "example-library",
          name: "Northbridge Community Library",
          city: "Northbridge",
        },
      ],
      more: false,
      page: 1,
    },
  },
  "GET /api/staff/team/example-team/widgets/access-libraries": {
    body: { libraryIds: ["example-library"] },
  },
  "GET /api/staff/team/example-team/widgets": { body: widgetWorkspace },
  "GET /api/staff/team/example-team/widgets/example-draft": { body: widget },
  "PUT /api/staff/team/example-team/widgets/example-draft": { body: widget },
  "PUT /api/staff/team/example-team/widgets/selections/example-selection": {
    body: selection,
  },
  "POST /api/staff/team/example-team/widgets/selections": { body: selection },
  "POST /api/staff/team/example-team/widgets": { body: widget },
}
