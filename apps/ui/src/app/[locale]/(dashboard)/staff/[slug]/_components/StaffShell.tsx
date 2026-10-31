"use client"

import { Icon } from "@iconify/react"
import type { PlanKey } from "@repo/access"
import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"

import { useOptionalDashboardOverlay } from "@/components/dashboard/DashboardFrame"
import { WorkspaceHero as PageHero } from "@/components/dashboard/WorkspaceHero"
import { Badge, LibrarySwitcher, PlanChip, SectionTabs } from "@/components/ds"
import { staffLibraryTabs } from "@/components/staff/staff-library-navigation"
import { useStaffWorkspaceRecord } from "@/components/staff/StaffWorkspaceRecord"
import type { StaffLibrarySummary } from "@/lib/access-server"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { StaffLibraryMeta } from "@/lib/staff/server"
import type { StaffOverview } from "@/lib/staff/types"

/**
 * The hero title with the type words in indigo italic: "… Mobile Library"
 * or "… Library" when the name ends that way, else its last word.
 */
export function staffHeroTitle(name: string): string {
  const clean = name.replaceAll("*", "").trim()
  for (const suffix of ["Mobile Library", "Library"]) {
    if (clean.length > suffix.length && clean.endsWith(suffix))
      return `${clean.slice(0, -suffix.length)}*${suffix}*`
  }
  const words = clean.split(/\s+/)
  if (words.length < 2) return clean
  const last = words.pop()

  return `${words.join(" ")} *${last}*`
}

/** The Team-plan tag on a gated tab carries the lock; the tab keeps its icon. */
const TEAM_TAG = <Badge label="Team" color="aurora" icon="mdi:lock-outline" />

/**
 * The staff area's hero and tabs for one library: breadcrumb, the
 * "Library staff" and type pills, the full-size italic title, the meta
 * line with the plan chip, the stacked library switcher with "Claim
 * another library" under it, and the section tabs (icons kept on gated
 * tabs; the lock sits in their "Team" tag).
 */
export function StaffShell({
  overview,
  libraries,
  meta,
  plan,
  teamCovered,
}: {
  readonly overview: StaffOverview
  readonly libraries: StaffLibrarySummary[]
  readonly meta: StaffLibraryMeta
  readonly plan: PlanKey
  readonly teamCovered: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tDashboard = useUiTranslations("dashboard")

  const { library, counts, role } = overview
  useStaffWorkspaceRecord({
    id: library.documentId,
    slug: library.slug,
    name: library.name,
    libraryType: library.libraryType,
    role,
    canGoLive:
      libraries.find((item) => item.id === library.documentId)?.canGoLive ??
      false,
    teamCovered,
    suggestions: counts.suggestions,
  })
  const pathname = usePathname()
  const segment = pathname.split("/staff/")[1]?.split("/")[1] || "overview"
  const mobile = library.libraryType === "Mobile"
  const tint = tintForLibraryType(library.libraryType)
  const inDashboard = useOptionalDashboardOverlay()
  const tabs = staffLibraryTabs(
    library.slug,
    mobile,
    tUi,
    counts.suggestions,
    tDashboard("overview")
  ).map((tab) => ({
    ...tab,
    badge:
      !teamCovered && ["traffic", "team"].includes(tab.id) ? (
        TEAM_TAG
      ) : tab.id === "live" ? (
        <Badge label="Mobile" color="ok" />
      ) : undefined,
  }))

  // Notices owns its task header; the workspace sidebar already identifies the library.
  if (inDashboard && segment === "notices") return null

  return (
    <PageHero
      variant="card"
      staff
      breadcrumb={
        inDashboard
          ? undefined
          : [
              { label: tUi("staff_area"), href: "/staff" },
              { label: library.name },
            ]
      }
      eyebrow="Library staff"
      eyebrowIcon="mdi:shield-account-outline"
      chips={
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
          style={{ background: tint.bg, color: tint.fg }}
        >
          <Icon
            aria-hidden="true"
            height={15}
            icon={mobile ? "mdi:bus-side" : "mdi:library-outline"}
            width={15}
          />
          {mobile ? "Mobile library" : `${library.libraryType} library`}
        </span>
      }
      title={staffHeroTitle(library.name)}
      meta={
        <>
          {meta.operatorName ? <span>{meta.operatorName}</span> : null}
          {mobile && meta.homeLibrary ? (
            <span>
              Based at{" "}
              {meta.homeLibrary.path ? (
                <Link
                  href={meta.homeLibrary.path}
                  className="font-semibold underline underline-offset-[3px]"
                  style={{ color: T.ink.base }}
                >
                  {meta.homeLibrary.name}
                </Link>
              ) : (
                meta.homeLibrary.name
              )}
            </span>
          ) : null}
          <Link
            href={library.path}
            className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            {tUi("view_public_page")}{" "}
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:arrow-top-right"
              width={15}
            />
          </Link>
          <PlanChip plan={plan} covered={teamCovered} />
        </>
      }
      tabs={
        inDashboard ? undefined : (
          <SectionTabs
            tabs={tabs}
            activeId={segment}
            label={tUi("staff_area")}
            roomy
          />
        )
      }
    >
      <div className="flex w-full max-w-[440px] flex-col gap-1 lg:ml-auto">
        <LibrarySwitcher
          libraries={libraries}
          currentId={library.documentId}
          hrefFor={(id) =>
            staffLibraryHref(libraries.find((lib) => lib.id === id)?.slug)
          }
        />
        <div className="flex flex-wrap gap-x-4">
          <Link
            href="/staff/claim"
            className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Claim another library
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:arrow-right"
              width={15}
            />
          </Link>
          <Link
            href="/staff/new"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Add a new library
            <Icon icon="mdi:plus" aria-hidden="true" width={15} />
          </Link>
        </div>
      </div>
    </PageHero>
  )
}
