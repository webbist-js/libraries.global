import { builderStateFromPrefill } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import { T } from "@/lib/design-tokens"
import { drivePlaceRefs } from "@/lib/drives/drive-view"
import { fetchPlaceNames } from "@/lib/drives/drive-view-server"
import { prefillFromParams, prefillQuery } from "@/lib/drives/propose-link"
import { privateMetadata } from "@/lib/seo/metadata"

import { requireBoardMember } from "../../_components/board"
import { CommunitySectionHeader } from "../../_components/CommunitySectionHeader"

export const metadata = privateMetadata("New drive")

/**
 * The editorial board's builder for a new drive (spec §5.7, board mode).
 * A propose link's query (`propose-link.ts`) prefills it, so a board
 * member sent here from "Propose as a drive" keeps the gap and place.
 */
export default async function NewDrivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams])
  const prefill = prefillFromParams(sp)
  await requireBoardMember(
    locale,
    `/community/drives/new${prefillQuery(prefill)}`
  )

  const names = await fetchPlaceNames(
    drivePlaceRefs({ places: prefill.places }),
    locale
  )

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        crumbs={[
          { label: "Drives", href: "/community#drives" },
          { label: "New drive" },
        ]}
        title="New *drive*"
        lead="Choose what the drive does (fill gaps, confirm details are still right, or complete whole records), where, and where helpers can find the answers. The drive is saved as scheduled; pin it or open it from its page."
      />
      <main className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
        <DriveBuilder
          initial={builderStateFromPrefill(prefill, names, "board")}
          locale={locale}
        />
      </main>
    </div>
  )
}
