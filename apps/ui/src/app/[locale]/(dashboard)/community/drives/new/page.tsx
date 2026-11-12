import { getTranslations } from "next-intl/server"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { builderStateFromPrefill } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import { BOARD_FLOW, DriveFlowPills } from "@/components/drives/DriveFlowPills"
import { MainContent } from "@/components/ds/MainContent"
import { withMessages } from "@/i18n/scoped-messages"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { T } from "@/lib/design-tokens"
import { drivePlaceRefs } from "@/lib/drives/drive-view"
import { fetchPlaceNames } from "@/lib/drives/drive-view-server"
import { prefillFromParams, prefillQuery } from "@/lib/drives/propose-link"
import { privateMetadata } from "@/lib/seo/metadata"

import { requireBoardMember } from "../../_components/board"

export const metadata = privateMetadata("New drive")

/**
 * The editorial board's builder for a new drive (spec §5.7, board mode).
 * A propose link's query (`propose-link.ts`) prefills it, so a board
 * member sent here from "Propose as a drive" keeps the gap and place.
 */
async function NewDrivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tStatic = await getTranslations("staticUi")

  const tExisting = await getTranslations()

  const tUi = await getTranslations("ui")

  const [{ locale }, sp] = await Promise.all([params, searchParams])
  const prefill = prefillFromParams(sp)
  const user = await requireBoardMember(
    locale,
    `/community/drives/new${prefillQuery(prefill)}`
  )

  const names = await fetchPlaceNames(
    drivePlaceRefs({ places: prefill.places }),
    locale
  )

  return (
    <AccountGuard expectedScope={contributionAccountScope(user)}>
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <WorkspacePageHeader
          density="task"
          breadcrumb={[
            { label: tUi("drives"), href: "/community#drives" },
            { label: tUi("new_drive") },
          ]}
          title={tExisting("ui.new_drive")}
          lead={tStatic(
            "communityRoute.create_a_drive_for_the_community_pick_the_job_and_the_place_and_the_live_preview_shows_what_helpers_"
          )}
          actions={<DriveFlowPills steps={BOARD_FLOW} />}
        />
        <MainContent className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
          <DriveBuilder
            initial={builderStateFromPrefill(prefill, names, "board")}
            locale={locale}
            userId={user.id}
            restoreDraft={prefillQuery(prefill) === ""}
          />
        </MainContent>
      </div>
    </AccountGuard>
  )
}

export default withMessages(
  NewDrivePage,
  "[locale]/(dashboard)/community/drives/new/page"
)
