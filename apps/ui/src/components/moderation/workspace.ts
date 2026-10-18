import type { ReviewCategory } from "@repo/access"
import {
  BookOpen,
  FileCheck2,
  Landmark,
  LibraryBig,
  MessagesSquare,
  Rocket,
} from "lucide-react"

export type ReviewView = ReviewCategory | "discussions"
export type WorkspaceView = {
  id: ReviewView
  href: string
  pending: number | null
  needsChanges?: number | null
}
export type CategoryStat = {
  category: ReviewCategory
  status: "pending" | "needs_info" | "decided"
  count: number
}

export const REVIEW_ICONS = {
  libraries: LibraryBig,
  articles: BookOpen,
  claims: Landmark,
  drives: Rocket,
  applications: FileCheck2,
  discussions: MessagesSquare,
} as const
