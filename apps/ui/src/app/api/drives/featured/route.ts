import { NextResponse } from "next/server"

import type { FeaturedDriveSummary } from "@/lib/contributor-shortcuts"
import { plainDriveTitle } from "@/lib/drives/drive-view"
import { fetchFeaturedDriveView } from "@/lib/drives/drive-view-server"

/**
 * The homepage's Featured (or first pinned) open drive, for the Contribute
 * menu's Drives card and the staff drawer (`useFeaturedDrive`). Plain
 * title, no markup, plus its progress numbers when something has been
 * counted.
 */
export async function GET() {
  const view = await fetchFeaturedDriveView("en")
  const data: FeaturedDriveSummary | null = view
    ? {
        title: plainDriveTitle(view.drive.title),
        slug: view.drive.slug,
        progress: view.progress
          ? {
              done: view.progress.done,
              total: view.progress.total,
              percent: view.progress.percent,
              unit: view.drive.unit,
            }
          : null,
      }
    : null

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  )
}
