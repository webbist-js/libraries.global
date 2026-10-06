import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DriveBoardActions } from "@/components/drives/DriveBoardActions"
import { isVotable } from "@/lib/community/suggestions"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { plainDriveTitle } from "@/lib/drives/drive-view"
import { loadDriveViews, openDriveCount } from "@/lib/drives/drive-view-server"
import { fetchDrive, fetchDriveLeaderboard } from "@/lib/drives/drives-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { DriveDetailPage } from "../../_components/DriveDetailPage"

type Params = Promise<{ locale: string; slug: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { locale, slug } = await params
  const drive = await fetchDrive(slug, locale)
  if (!drive) {
    return buildMetadata({
      title: "Drive not found",
      locale,
      robots: "noindex",
    })
  }

  return buildMetadata({
    title: plainDriveTitle(drive.title),
    description: drive.summary,
    path: `community/drives/${drive.slug}`,
    locale,
    // Open and finished drives are indexable (D15); a cancelled one isn't.
    robots: drive.status === "cancelled" ? "noindex" : "index",
  })
}

export default async function DrivePage({ params }: { params: Params }) {
  const { locale, slug } = await params
  const drive = await fetchDrive(slug, locale)
  if (!drive) notFound()

  const credited = drive.status === "open" || drive.status === "closed"
  const [[view], week, all, openCount, suggestions] = await Promise.all([
    loadDriveViews([drive], locale),
    drive.status === "open"
      ? fetchDriveLeaderboard(drive.documentId, "week")
      : Promise.resolve([]),
    credited
      ? fetchDriveLeaderboard(drive.documentId, "all")
      : Promise.resolve([]),
    openDriveCount(locale),
    fetchPublicSuggestions(),
  ])

  return (
    <DriveDetailPage
      drive={drive}
      view={view ?? null}
      week={week}
      all={all}
      counts={{
        noticeboard: openCount,
        suggestions: suggestions.filter(isVotable).length,
      }}
      boardActions={<DriveBoardActions drive={drive} />}
    />
  )
}
