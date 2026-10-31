"use client"

import { Heart, MessagesSquare, Pin, ThumbsUp, Trophy } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  activeCommunityTab,
  communityTabs,
  type CommunityTabCounts,
} from "@/app/[locale]/(dashboard)/community/_components/CommunityNavBar"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { useHydratedSession } from "@/lib/access-client"
import { openDiscussionComposer } from "@/lib/discussion-composer"
import { Link, usePathname } from "@/lib/navigation"

type CommunityTab =
  | "noticeboard"
  | "leaderboard"
  | "suggestions"
  | "discussions"
  | "supporters"
const ICONS = {
  noticeboard: Pin,
  leaderboard: Trophy,
  suggestions: ThumbsUp,
  discussions: MessagesSquare,
  supporters: Heart,
}

export function CommunityWorkspace({
  children,
  standing,
  counts,
}: {
  readonly children: ReactNode
  readonly standing: ReactNode
  readonly counts: CommunityTabCounts
}) {
  const t = useTranslations("communityDashboard"),
    ui = useTranslations("ui")
  const path = usePathname(),
    active = (activeCommunityTab(path) ?? "noticeboard") as CommunityTab
  const { data } = useHydratedSession(),
    user = data?.user
  const board = user?.capabilities?.includes("drives.manage")
  const supporting = ["supporter", "pro", "team"].includes(user?.plan ?? "")
  const actions: Record<
    string,
    { title: string; body: string; label: string; href: string; help: string }
  > = {
    noticeboard: {
      title: t("driveTitle"),
      body: t("driveBody"),
      label: t(board ? "newDrive" : "proposeDrive"),
      href: board ? "/community/drives/new" : "/community/propose",
      help: "/knowledge?section=contributing",
    },
    leaderboard: {
      title: t("contributeTitle"),
      body: t("contributeBody"),
      label: ui("add_a_library"),
      href: "/contribute/index/new",
      help: "/knowledge?section=governance",
    },
    suggestions: {
      title: t("suggestTitle"),
      body: t("suggestBody"),
      label: t("suggestAction"),
      href: "/community/suggestions#suggest-item",
      help: "/knowledge?section=governance",
    },
    discussions: {
      title: t("discussTitle"),
      body: t("discussBody"),
      label: t("discussAction"),
      href: "/community/discussions?compose=1",
      help: "/knowledge?section=governance",
    },
    supporters: {
      title: t(supporting ? "supportThanks" : "supportTitle"),
      body: t("supportBody"),
      label: t(supporting ? "manageSupport" : "supportAction"),
      href: supporting ? "/profile/membership" : "/plans",
      help: "/plans",
    },
  }
  const cta = actions[active]!
  const tabs = communityTabs(counts)

  return (
    <DashboardPage
      routeKey={path}
      title={ui("community")}
      className="dashboard-community-page"
      navigationHeading={<RecordContextIdentity title={ui("community")} />}
      navigation={
        <>
          <nav
            className="community-sidebar-navigation"
            aria-label={ui("community")}
          >
            {tabs.map((tab) => {
              const Icon = ICONS[tab.id as keyof typeof ICONS]

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active === tab.id ? "page" : undefined}
                >
                  <Icon size={19} aria-hidden />
                  <span>{t(tab.id as CommunityTab)}</span>
                  {tab.count ? <small>{tab.count}</small> : null}
                </Link>
              )
            })}
          </nav>
          <div className="community-sidebar-standing">{standing}</div>
        </>
      }
      navigationFooter={
        <DashboardSidebarCta
          title={cta.title}
          body={cta.body}
          action={
            active === "discussions"
              ? { label: cta.label, onClick: openDiscussionComposer }
              : { label: cta.label, href: cta.href }
          }
          secondary={{ label: t("learnMore"), href: cta.help }}
        />
      }
      toolbar={
        <RecordToolbar
          items={[
            { label: ui("home"), href: "/" },
            {
              label: ui("community"),
              href: active === "noticeboard" ? undefined : "/community",
            },
            ...(active !== "noticeboard" ? [{ label: t(active) }] : []),
          ]}
        />
      }
      overview={<div className="community-page-content">{children}</div>}
    />
  )
}
