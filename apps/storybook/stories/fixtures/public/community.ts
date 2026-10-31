import type { ContributionItem } from "@/components/contributions/contributions"
import type { Standing } from "@/lib/community/leaderboard-server"
import type {
  PublicSuggestion,
  SuggestionReviewRound,
} from "@/lib/community/suggestions"
import type { LeaderboardEntry } from "@/lib/types/leaderboard"

export const optionNames = {
  accessibility: ["Step-free entrance", "Accessible toilet"],
  amenities: ["Reading room"],
  services: ["Printing"],
  library_types: ["Public", "Academic"],
}
export const suggestion: PublicSuggestion = {
  documentId: "example-suggestion",
  name: "Quiet study spaces",
  optionKey: "amenities",
  status: "open",
  votes: 24,
  votesThisMonth: 9,
  voted: false,
  publicationStatus: "published",
  description:
    "Record whether a library has a dedicated quiet study area, separate from group activities.",
  suggestedByName: "Maya S.",
  suggestedByProfile: "example-maya",
  createdAt: "2026-01-15T12:00:00Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 12,
  commentCount: 0,
  conversation: { count: 0, participants: [] },
}
export const suggestions: PublicSuggestion[] = [
  suggestion,
  {
    ...suggestion,
    documentId: "example-suggestion-review",
    name: "Community seed exchange",
    optionKey: "services",
    status: "reviewing",
    votes: 17,
  },
  {
    ...suggestion,
    documentId: "example-suggestion-accepted",
    name: "Bookable study rooms",
    status: "accepted",
    decisionKind: "add",
    decidedAt: "2026-01-20T12:00:00Z",
    decisionNote: "Approved for the facilities catalogue.",
  },
]
export const reviewRound: SuggestionReviewRound = {
  documentId: "example-round",
  version: 1,
  opensAt: "2026-01-01T00:00:00Z",
  cutoffAt: "2026-01-31T23:59:59Z",
  reviewAt: "2026-02-03T12:00:00Z",
  capacity: 5,
  state: "voting",
  shortlist: [],
}
export const standing: Standing = {
  globalRank: 12,
  monthRank: 3,
  periodRank: 3,
  tier: {
    level: 2,
    name: "Contributor",
    nextName: "Archivist",
    nextThreshold: 500,
    progressPercent: 62,
  },
  streak: 4,
  totalPoints: 310,
  pointsThisMonth: 120,
  recentBadges: [],
  suggestedAction: "Check the opening times at your local library.",
}
export const leaderboard: LeaderboardEntry[] = ["Maya", "Ben", "Ari"].map(
  (firstName, index) => ({
    rank: index + 1,
    username: `example-${firstName.toLowerCase()}`,
    firstName,
    lastName: "S.",
    country: "Example country",
    city: "Northbridge",
    avatarUrl: null,
    contributorRole: "contributor",
    periodPoints: 120 - index * 25,
    totalPoints: 500 - index * 75,
    tier: "Contributor",
    approvedCount: 12 - index,
    acceptanceRate: 95,
  })
)
export const contributions: ContributionItem[] = [
  {
    documentId: "example-edit",
    submissionType: "correction",
    status: "approved",
    targetLabel: "Northbridge Library",
    editSummary:
      "Confirmed the weekend opening hours using the library’s website.",
    createdAt: "2026-01-15T12:00:00Z",
  },
  {
    documentId: "example-pending",
    submissionType: "blog_submission",
    status: "pending",
    targetLabel: "A reading room for everyone",
    editSummary: "Shared a field note from the library.",
    createdAt: "2026-01-16T12:00:00Z",
  },
]
