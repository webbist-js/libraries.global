import { NextResponse } from "next/server"

import { plainDriveTitle } from "@/lib/drives/drive-view"
import { fetchFeaturedDriveView } from "@/lib/drives/drive-view-server"

/**
 * The homepage's Featured (or first pinned) open drive, for the Contribute
 * menu's "Drives" group (`useContributorShortcuts`). Plain title, no markup.
 */
export async function GET() {
  const view = await fetchFeaturedDriveView("en")

  return NextResponse.json(
    {
      data: view
        ? { title: plainDriveTitle(view.drive.title), slug: view.drive.slug }
        : null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  )
}
