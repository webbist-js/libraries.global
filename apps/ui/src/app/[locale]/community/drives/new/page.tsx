import { emptyBuilderState } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { requireBoardMember } from "../../_components/board"
import { CommunitySectionHeader } from "../../_components/CommunitySectionHeader"

export const metadata = privateMetadata("New drive")

/** The editorial board's builder for a new drive (spec §5.7, board mode). */
export default async function NewDrivePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireBoardMember(locale, "/community/drives/new")

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
        lead="Choose the gaps, where they are and where helpers can find the answers. The drive is saved as scheduled; pin it or open it from its page."
      />
      <DriveBuilder initial={emptyBuilderState()} locale={locale} />
    </div>
  )
}
