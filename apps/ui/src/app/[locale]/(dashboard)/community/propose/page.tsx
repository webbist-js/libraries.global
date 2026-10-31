import { DRIVE_PROPOSAL_MIN_ACCEPTED } from "@repo/access"
import { headers } from "next/headers"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { builderStateFromPrefill } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import {
  DriveFlowPills,
  PROPOSE_FLOW,
} from "@/components/drives/DriveFlowPills"
import { Notice } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import GlobalLink from "@/components/global/GlobalLink"
import { sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { T } from "@/lib/design-tokens"
import { drivePlaceRefs } from "@/lib/drives/drive-view"
import { fetchPlaceNames } from "@/lib/drives/drive-view-server"
import {
  prefillFromParams,
  prefillQuery,
  proposeHref,
} from "@/lib/drives/propose-link"
import { proposalStanding } from "@/lib/drives/propose-server"
import { redirect } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"

export const metadata = privateMetadata("Propose a drive")

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const LINK =
  "font-semibold underline underline-offset-[3px] hover:text-(--t-accent-primary-hover)"

/** The role application page's container (`/contribute/knowledge/apply`). */
const MAIN = "mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8"

/**
 * The builder in proposal mode (spec §5.7): anyone signed in with
 * standing proposes a drive, and a Moderator reviews it in the `index`
 * queue. A link's query prefills it (`propose-link.ts`). The board makes
 * drives directly, so a board member goes to New drive with the same
 * prefill (OD-8). Strapi's submission policy decides on send; the standing
 * read here only explains why sending is off, in the builder's side column.
 */
export default async function ProposeDrivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, sp] = await Promise.all([params, searchParams])
  const prefill = prefillFromParams(sp)
  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null

  if (user && sessionCapabilities(user).set.has("drives.manage")) {
    redirect({
      href: `/community/drives/new${prefillQuery(prefill)}`,
      locale: locale as Locale,
    })
  }

  const header = (
    <WorkspacePageHeader
      density="task"
      breadcrumb={[{ label: "Propose a drive" }]}
      title="Propose a drive"
      lead="A drive gets the community working on one job in one place for a few weeks. Pick the job and the place, and the live preview shows what helpers will see."
      actions={<DriveFlowPills steps={PROPOSE_FLOW} />}
    />
  )
  const page = (children: ReactNode) => (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      {header}
      {children}
    </div>
  )

  if (!user) {
    const signIn = `/auth/signin?callbackUrl=${encodeURIComponent(proposeHref(prefill))}`

    return page(
      <MainContent className={MAIN}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:gap-6">
          <div className="min-w-0">
            <Notice
              icon="mdi:information-outline"
              tone="info"
              title={tUi("sign_in_to_propose_a_drive")}
            >
              <p className="m-0" style={{ color: T.ink.base }}>
                <GlobalLink
                  href={signIn}
                  className={LINK}
                  style={{ color: T.accent.primary }}
                >
                  {tUi("sign_in")}{" "}
                </GlobalLink>{" "}
                to choose what a drive does and where.
              </p>
            </Notice>
          </div>
        </div>
      </MainContent>
    )
  }

  const [names, standing] = await Promise.all([
    fetchPlaceNames(drivePlaceRefs({ places: prefill.places }), locale),
    proposalStanding(user),
  ])
  const initial = builderStateFromPrefill(prefill, names, "propose")

  let blocked: string | null = null
  if (standing.accepted < DRIVE_PROPOSAL_MIN_ACCEPTED) {
    blocked = `You need ${DRIVE_PROPOSAL_MIN_ACCEPTED} accepted changes to propose a drive. You have ${standing.accepted}.`
  } else if (standing.open) {
    blocked = "Your proposal is waiting for review."
  }

  return page(
    <AccountGuard expectedScope={contributionAccountScope(user)}>
      <MainContent className={MAIN}>
        <DriveBuilder
          mode="propose"
          initial={initial}
          locale={locale}
          blocked={blocked}
          userId={user.id}
          restoreDraft={prefillQuery(prefill) === ""}
          standing={{
            accepted: standing.accepted,
            open: standing.open ? { title: standing.open.title } : null,
          }}
        />
      </MainContent>
    </AccountGuard>
  )
}
