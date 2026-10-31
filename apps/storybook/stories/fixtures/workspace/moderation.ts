import type {
  ModerationRow,
  ReviewEvent,
  RoleApplicant,
  OptionSuggestion,
} from "@/components/moderation/submissionMeta"
import type { WorkspaceView } from "@/components/moderation/workspace"

export const moderationRow: ModerationRow = {
  documentId: "example-submission",
  submissionType: "library_correction",
  queue: "index",
  status: "pending",
  locale: "en",
  summary: "Update Northbridge Library opening hours",
  targetSlug: "northbridge",
  submittedByName: "Maya S.",
  createdAt: "2026-01-15T10:00:00Z",
  reviewedAt: null,
  drive: {
    documentId: "example-drive",
    slug: "opening-hours",
    title: "Check opening hours",
  },
}
export const reviewEvents: ReviewEvent[] = [
  {
    documentId: "example-review",
    fromStatus: "pending",
    toStatus: "needs_info",
    reviewerKind: "moderator",
    byViewer: false,
    note: "Please include the library’s published opening-hours page as a source.",
    createdAt: "2026-01-15T12:00:00Z",
  },
]
export const applicant: RoleApplicant = {
  username: "example-member",
  acceptedCount: 12,
  recentAccepted: [
    {
      summary: "Updated library contact details",
      type: "library_correction",
      decidedAt: "2026-01-10T12:00:00Z",
    },
  ],
}
export const views: WorkspaceView[] = [
  {
    id: "libraries",
    href: "/moderation/libraries",
    pending: 8,
    needsChanges: 2,
  },
  { id: "articles", href: "/moderation/articles", pending: 3, needsChanges: 1 },
  { id: "claims", href: "/moderation/claims", pending: 2, needsChanges: 0 },
  {
    id: "applications",
    href: "/moderation/applications",
    pending: 1,
    needsChanges: 0,
  },
]
export const optionSuggestion: OptionSuggestion = {
  documentId: "example-option",
  name: "Quiet study room",
  optionKey: "amenities",
  status: "open",
  requests: 3,
  votes: 5,
  libraries: [{ documentId: "example-library", name: "Northbridge Library" }],
  unlinkedLibraries: [],
  description: "A dedicated room for quiet study.",
  suggestedByName: "Maya S.",
  decidedAt: null,
  decidedBy: null,
  decisionNote: null,
}
