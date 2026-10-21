import { notFound } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { builderStateFromDrive } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import { MainContent } from "@/components/ds/MainContent"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { T } from "@/lib/design-tokens"
import {
  driveHref,
  drivePlaceRefs,
  plainDriveTitle,
} from "@/lib/drives/drive-view"
import { fetchPlaceNames } from "@/lib/drives/drive-view-server"
import { fetchDrive } from "@/lib/drives/drives-server"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"

import { requireBoardMember } from "../../../_components/board"
import { CommunitySectionHeader } from "../../../_components/CommunitySectionHeader"

export const metadata = privateMetadata("Edit drive")

type Params = Promise<{ locale: string; slug: string }>

/**
 * The editorial board's builder for a saved drive. It edits the drive in the
 * default locale, the one the builder writes. Once the drive has opened only
 * its words and where to look can change.
 */
export default async function EditDrivePage({ params }: { params: Params }) {
  const tUi = await getUiTranslations("ui")

  const { locale, slug } = await params
  const user = await requireBoardMember(
    locale,
    `/community/drives/${slug}/edit`
  )

  const drive = await fetchDrive(slug, routing.defaultLocale)
  if (!drive) notFound()

  const names = await fetchPlaceNames(
    drivePlaceRefs(drive.scope ?? {}),
    routing.defaultLocale
  )
  const initial = builderStateFromDrive(
    drive,
    new Map([...names].map(([key, place]) => [key, place.name] as const))
  )
  const title = plainDriveTitle(drive.title)

  return (
    <AccountGuard expectedScope={contributionAccountScope(user)}>
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <CommunitySectionHeader
          crumbs={[
            { label: tUi("drives"), href: "/community#drives" },
            { label: title, href: driveHref(drive.slug) },
            { label: tUi("edit") },
          ]}
          title={`Edit *${title}*`}
          lead="Changes show on the drive’s page and the Noticeboard as soon as they’re saved."
        />
        <MainContent className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
          <DriveBuilder
            initial={initial}
            locale={locale}
            drive={{
              documentId: drive.documentId,
              slug: drive.slug,
              status: drive.status,
            }}
          />
        </MainContent>
      </div>
    </AccountGuard>
  )
}
