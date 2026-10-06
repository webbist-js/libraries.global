import { DRIVE_PROPOSAL_MIN_ACCEPTED } from "@repo/access"
import { headers } from "next/headers"
import type { Locale } from "next-intl"
import type { ReactNode } from "react"

import { builderStateFromPrefill } from "@/components/drives/builder.logic"
import { DriveBuilder } from "@/components/drives/DriveBuilder"
import { Notice } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
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

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

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
    <CommunitySectionHeader
      crumbs={[{ label: "Propose a drive" }]}
      title="Propose a *drive*."
      lead="Choose what the drive does (fill a gap, confirm details are still right, or complete whole records) and a place. A Moderator reviews every proposal, and approved drives open on their start date."
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
      <main className={MAIN}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:gap-6">
          <div className="min-w-0">
            <Notice
              icon="mdi:information-outline"
              tone="info"
              title="Sign in to propose a drive"
            >
              <p className="m-0" style={{ color: T.ink.base }}>
                <GlobalLink
                  href={signIn}
                  className={LINK}
                  style={{ color: T.accent.primary }}
                >
                  Sign in
                </GlobalLink>{" "}
                to choose what a drive does and where.
              </p>
            </Notice>
          </div>
        </div>
      </main>
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
    <main className={MAIN}>
      <DriveBuilder
        mode="propose"
        initial={initial}
        locale={locale}
        blocked={blocked}
        standing={{
          accepted: standing.accepted,
          open: standing.open ? { title: standing.open.title } : null,
        }}
      />
    </main>
  )
}
