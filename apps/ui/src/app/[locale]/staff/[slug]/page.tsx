import { Icon } from "@iconify/react"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { HealthList } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { healthNote } from "@/lib/staff/format"
import { staffLibraryHref } from "@/lib/staff/paths"
import { loadStaffPage } from "@/lib/staff/server"

import { StaffSuggestions } from "../_components/StaffSuggestions"
import { StaffVerifyButton } from "../_components/StaffVerifyButton"
import { QuickActions, type QuickAction } from "./_components/QuickActions"

const LINK =
  "inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"

export default async function StaffOverviewPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale, slug } = await params
  const { overview, user, libraries, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const base = staffLibraryHref(slug)
  const mobile = overview.library.libraryType === "Mobile"
  const canGoLive =
    libraries.find((lib) => lib.id === documentId)?.canGoLive === true
  const trafficCovered =
    requireEntitlementForLibrary(user, "library.traffic", documentId) === null
  const health = overview.health.map((row) => ({
    ...row,
    note: healthNote(row.note),
    // Older API builds address staff pages by document ID. Keep the action's
    // destination and step, but use the current slug-based staff route.
    ...(row.action && {
      action: {
        ...row.action,
        href: row.action.href.replace(
          /^\/(?:contribute\/)?staff\/[^/?#]+/,
          base
        ),
      },
    }),
  }))
  const actions: QuickAction[] = [
    {
      icon: "mdi:bullhorn-outline",
      label: "Post a closure or notice",
      href: `${base}/notices#post-notice`,
    },
    ...(mobile
      ? [
          {
            icon: "mdi:calendar-clock",
            label: "Edit the timetable",
            href: `${base}/edit?step=timetable`,
            tag: "Mobile",
          },
          // The console itself for anyone allowed to go live; the settings
          // for everyone, so an owner can switch live sharing on.
          ...(canGoLive
            ? [
                {
                  icon: "mdi:broadcast",
                  label: tUi("go_live"),
                  href: `/live/${documentId}`,
                  tag: "Mobile",
                },
              ]
            : []),
          {
            icon: "mdi:bus-side",
            label: "Live sharing settings",
            href: `${base}/live`,
            tag: "Mobile",
          },
        ]
      : [
          {
            icon: "mdi:clock-outline",
            label: "Edit opening hours",
            href: `${base}/edit?step=hours`,
          },
        ]),
    {
      icon: "mdi:pencil-outline",
      label: tUi("edit_the_record"),
      href: `${base}/edit`,
    },
    {
      icon: "mdi:calendar-sync-outline",
      label: "Connect an event feed",
      href: `${base}/events/connect`,
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <StaffSuggestions
          libraryDocumentId={documentId}
          publicPath={overview.library.path}
        />
        <LearnMoreLink
          slug={KNOWLEDGE_SLUGS.staffArea}
          locale={locale as Locale}
          className="px-1"
        />
      </div>
      <aside className="flex flex-col gap-5">
        <HealthList
          title={tUi("record_health")}
          rows={health}
          renderAction={(row) =>
            row.key === "hours" && row.status === "ok" ? (
              <StaffVerifyButton id={documentId} sections={["hours"]} />
            ) : undefined
          }
          score={{
            done: health.filter((row) => row.status === "ok").length,
            total: health.length,
          }}
        />
        <section
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
          aria-labelledby="traffic-card-heading"
        >
          <h2
            id="traffic-card-heading"
            className="m-0 text-[18px] font-semibold"
          >
            {tUi("traffic")}
          </h2>
          <p className="my-2 text-[15px]" style={{ color: T.ink.dim }}>
            {trafficCovered
              ? "See traffic reports for your library’s page."
              : "See visits to your library’s page with the Team plan. Traffic reports are coming soon."}
          </p>
          <Link
            href={`${base}/traffic`}
            className={LINK}
            style={{ color: T.accent.primary }}
          >
            {trafficCovered ? "View traffic" : "What’s in Team"}
            <Icon
              aria-hidden="true"
              icon="mdi:arrow-right"
              width={16}
              height={16}
            />
          </Link>
        </section>
        <QuickActions actions={actions} />
      </aside>
    </div>
  )
}
