import { DashboardLoading } from "@/components/dashboard/DashboardLoading"

/** Matches the dashboard rail and the section's current browsing/reading layout. */
export function JournalLoading({
  article = false,
}: {
  readonly article?: boolean
}) {
  return (
    <DashboardLoading
      kind={article ? "article" : "journal"}
      articleImage={article}
    />
  )
}
