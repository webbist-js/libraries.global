export type SuggestionReviewRound = {
  documentId: string
  version: number
  opensAt: string
  cutoffAt: string
  reviewAt: string
  capacity: number
  state: "voting" | "review" | "closed"
  snapshotAt?: string | null
  shortlist: {
    documentId: string
    name: string
    optionKey: "accessibility" | "amenities" | "services" | "library_types"
    votes: number
    rank: number
  }[]
}

/** One ranking policy for the public board, moderators and stored snapshots. */
export function compareSuggestionRank(
  a: { votes: number; createdAt?: string | null; documentId: string },
  b: { votes: number; createdAt?: string | null; documentId: string }
): number {
  return (
    b.votes - a.votes ||
    (Date.parse(a.createdAt ?? "") || 0) -
      (Date.parse(b.createdAt ?? "") || 0) ||
    a.documentId.localeCompare(b.documentId)
  )
}
