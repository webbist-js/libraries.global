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

/** Notices sit in the builder's column, above it. */
function NoticeColumn({ children }: { readonly children: ReactNode }) {
  return (
    <div
      className="mx-auto flex w-full max-w-[860px] flex-col gap-3"
      style={{ padding: "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) 0" }}
    >
      {children}
    </div>
  )
}

/**
 * The builder in proposal mode (spec §5.7): anyone signed in with
 * standing proposes a drive, and a Moderator reviews it in the `index`
 * queue. A link's query prefills it (`propose-link.ts`). The board makes
 * drives directly, so a board member goes to New drive with the same
 * prefill (OD-8). Strapi's submission policy decides on send; the standing
 * read here only explains why sending is off.
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
      lead="Pick one gap and a place. A Moderator reviews every proposal, and approved drives open on their start date."
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
      <NoticeColumn>
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
            to choose a gap and a place for a drive.
          </p>
        </Notice>
      </NoticeColumn>
    )
  }

  const [names, standing] = await Promise.all([
    fetchPlaceNames(drivePlaceRefs({ places: prefill.places }), locale),
    proposalStanding(user),
  ])
  const initial = builderStateFromPrefill(prefill, names, "propose")

  let blocked: string | null = null
  let notice: ReactNode = null
  if (standing.accepted < DRIVE_PROPOSAL_MIN_ACCEPTED) {
    blocked = `You need ${DRIVE_PROPOSAL_MIN_ACCEPTED} accepted changes to propose a drive. You have ${standing.accepted}.`
    notice = (
      <Notice
        icon="mdi:alert-outline"
        tone="warn"
        title={`You need ${DRIVE_PROPOSAL_MIN_ACCEPTED} accepted changes to propose a drive.`}
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          You have {standing.accepted}.{" "}
          <GlobalLink
            href="/contribute"
            className={LINK}
            style={{ color: T.accent.primary }}
          >
            Improve a record
          </GlobalLink>
        </p>
      </Notice>
    )
  } else if (standing.open) {
    blocked = "Your proposal is waiting for review."
    notice = (
      <Notice
        icon="mdi:information-outline"
        tone="info"
        title={
          standing.open.title
            ? `Your proposal “${standing.open.title}” is waiting for review.`
            : "Your proposal is waiting for review."
        }
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          You can propose another once it’s decided.{" "}
          <GlobalLink
            href="/contribute/submissions"
            className={LINK}
            style={{ color: T.accent.primary }}
          >
            My submissions
          </GlobalLink>
        </p>
      </Notice>
    )
  }

  return page(
    <>
      {notice ? <NoticeColumn>{notice}</NoticeColumn> : null}
      <DriveBuilder
        mode="propose"
        initial={initial}
        locale={locale}
        blocked={blocked}
      />
    </>
  )
}
