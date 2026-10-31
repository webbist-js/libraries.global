import { defaultWidgetConfig, type WidgetWorkspace } from "@repo/shared-data"

const config = defaultWidgetConfig()
const spec = {
  schemaVersion: 1,
  membership: "follow_sources",
  sources: [{ kind: "owning_team" }],
  includeLibraryIds: [],
  excludeLibraryIds: [],
  filters: {},
  groups: [],
} satisfies WidgetWorkspace["selections"][number]["spec"]
const selection = {
  documentId: "example-selection",
  name: "Example Team libraries",
  version: 1,
  spec,
  updatedAt: "2026-01-15T12:00:00Z",
  usedBy: [
    {
      documentId: "example-draft",
      name: "Example library finder",
      state: "draft",
    },
    {
      documentId: "example-live",
      name: "Example published directory",
      state: "live",
    },
  ],
} satisfies WidgetWorkspace["selections"][number]
const draft = {
  documentId: "example-draft",
  publicId: "example-finder",
  name: "Example library finder",
  type: "finder",
  config,
  selection,
  draftVersion: 1,
  state: "draft",
  reviewRequested: false,
  hasChanges: false,
  publishedVersion: 0,
  origins: [],
  updatedAt: "2026-01-15T12:00:00Z",
  release: null,
  history: [],
  loads: 0,
  blockedReports: 0,
} satisfies WidgetWorkspace["widgets"][number]
const release = {
  documentId: "example-release",
  version: 1,
  publishedAt: "2026-01-15T12:00:00Z",
  type: "directory",
  config: { ...config, title: "Example library directory" },
  spec,
  selectionName: selection.name,
  selectionVersion: selection.version,
} satisfies NonNullable<WidgetWorkspace["widgets"][number]["release"]>

export const widgetWorkspace: WidgetWorkspace = {
  team: {
    documentId: "example-team",
    name: "Example Library Team",
    active: true,
    organiser: true,
    branding: false,
    libraryCount: 3,
    primaryNetwork: {
      documentId: "example-service",
      name: "Example Library Service",
      kind: "library_service",
    },
  },
  widgets: [
    draft,
    {
      ...draft,
      documentId: "example-live",
      publicId: "example-directory",
      name: "Example published directory",
      type: "directory",
      config: release.config,
      state: "live",
      draftVersion: 2,
      publishedVersion: 1,
      hasChanges: true,
      origins: ["https://example.invalid"],
      release,
      history: [release],
    },
  ],
  selections: [selection],
}
