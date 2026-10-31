"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import {
  Award,
  Bell,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PencilLine,
  Settings2,
  Wallet,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, type Ref } from "react"

import { BadgesSection } from "@/app/[locale]/profile/[username]/_components/sections/BadgesSection"
import { ContributionsSection } from "@/app/[locale]/profile/[username]/_components/sections/ContributionsSection"
import { FollowingSection } from "@/app/[locale]/profile/[username]/_components/sections/FollowingSection"
import { OverviewSection } from "@/app/[locale]/profile/[username]/_components/sections/OverviewSection"
import { SettingsShell } from "@/app/[locale]/profile/settings/_components/SettingsShell"
import { useContactModal } from "@/components/contact/ContactModalProvider"
import { MembershipDashboard } from "@/components/membership/MembershipDashboard"
import { NetworkAffiliations } from "@/components/networks/NetworkAffiliations"
import { NotificationInbox } from "@/components/notifications/NotificationInbox"
import { useNotifications } from "@/components/notifications/NotificationProvider"
import { StaffDrawerMenuItem } from "@/components/staff/StaffDrawerMenuItem"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import type { BetterAuthUser } from "@/lib/auth-server"
import { Link } from "@/lib/navigation"
import {
  closeProfileDrawer,
  openProfileDrawer,
  PROFILE_SECTIONS,
  type ProfileSection,
} from "@/lib/profile-drawer"

import type { Workspace } from "./profile-workspace.types"

type Props = {
  readonly user: BetterAuthUser
  readonly section: ProfileSection
  readonly query: UseQueryResult<Workspace>
  readonly onDirtyChange: (dirty: boolean) => void
  readonly onRefresh: () => void
  readonly onHandoff: (action: () => void) => void
  readonly saveActionsTarget?: HTMLElement | null
}

const SECTION_ICONS = {
  overview: LayoutDashboard,
  contributions: PencilLine,
  following: Heart,
  recognition: Award,
  notifications: Bell,
  membership: Wallet,
  settings: Settings2,
}

function useSectionLabels() {
  const ui = useTranslations("ui"),
    t = useTranslations("dashboard")

  return {
    overview: t("overview"),
    contributions: t("contributions"),
    following: ui("following"),
    recognition: ui("badges_points"),
    notifications: ui("notifications"),
    membership: ui("membership"),
    settings: ui("settings"),
  }
}

export function ProfileWorkspace(props: Props) {
  const t = useTranslations("dashboard"),
    ui = useTranslations("ui")
  const content = useRef<HTMLDivElement>(null)
  const previousSection = useRef(props.section)
  useEffect(() => {
    const scroller = content.current
    if (scroller && previousSection.current !== props.section) {
      scroller.scrollTop = 0
    }
    previousSection.current = props.section
  }, [props.section])

  return (
    <div className="profile-workspace">
      <ProfileWorkspaceNavigation user={props.user} section={props.section} />
      <div ref={content} className="profile-workspace-content">
        <section
          className="profile-workspace-section"
          data-profile-section={props.section}
        >
          {props.query.isPending ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{t("loadingProfile")}</span>
              <div aria-hidden="true" className="grid gap-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[0, 1, 2, 3].map((stat) => (
                    <Skeleton key={stat} className="h-24 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-64 rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-36 rounded-2xl" />
                  <Skeleton className="h-36 rounded-2xl" />
                </div>
              </div>
            </div>
          ) : props.query.error ? (
            <div role="alert">
              <p>{t("profileUnavailable")}</p>
              <button
                className="dashboard-navigation-link"
                onClick={async () => {
                  await props.query.refetch()
                }}
              >
                {ui("retry")}
              </button>
            </div>
          ) : props.query.data ? (
            <ProfileWorkspaceSection {...props} data={props.query.data} />
          ) : null}
        </section>
      </div>
    </div>
  )
}

function ProfileWorkspaceNavigation({
  user,
  section,
}: Pick<Props, "user" | "section">) {
  const labels = useSectionLabels(),
    ui = useTranslations("ui")
  const { unread } = useNotifications()
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const row = nav.current
    const selected = row?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row || !selected) return
    const reveal = () => {
      if (selected.offsetLeft < row.scrollLeft)
        row.scrollLeft = selected.offsetLeft
      else if (
        selected.offsetLeft + selected.offsetWidth >
        row.scrollLeft + row.clientWidth
      )
        row.scrollLeft =
          selected.offsetLeft + selected.offsetWidth - row.clientWidth
    }
    reveal()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(reveal)
    observer.observe(row)

    return () => observer.disconnect()
  }, [section])

  return (
    <nav
      ref={nav}
      className="profile-workspace-navigation"
      aria-label={ui("profile_sections")}
    >
      {PROFILE_SECTIONS.map((value) => {
        const SectionIcon = SECTION_ICONS[value]

        return (
          <button
            key={value}
            type="button"
            className="profile-workspace-tab"
            aria-label={
              value === "notifications" && unread
                ? `${labels[value]} (${unread})`
                : undefined
            }
            aria-current={section === value ? "page" : undefined}
            onClick={() => openProfileDrawer(value, user.id)}
          >
            <SectionIcon size={18} aria-hidden="true" />
            {labels[value]}
            {value === "notifications" && unread ? (
              <span className="profile-workspace-count">{unread}</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}

export function ProfileWorkspaceActions({
  user,
  onHandoff,
  saveActionsRef,
}: Pick<Props, "user" | "onHandoff"> & {
  readonly saveActionsRef?: Ref<HTMLDivElement>
}) {
  const ui = useTranslations("ui")
  const { openContact } = useContactModal()
  const caps = new Set<string>(user.capabilities)

  return (
    <div
      className="profile-workspace-actions"
      aria-label={ui("account")}
      role="group"
    >
      <div className="profile-workspace-account-actions">
        {["supporter", "pro", "team"].includes(user.plan ?? "") ? (
          <Button
            variant="surface"
            size="pill"
            type="button"
            onClick={() => onHandoff(() => openContact("membership_support"))}
          >
            <MessageCircle aria-hidden="true" />
            {ui("support")}
          </Button>
        ) : null}
        <Link
          href="/auth/signout"
          className={buttonVariants({ variant: "surface", size: "pill" })}
          onNavigate={(event) => {
            if (!closeProfileDrawer()) event.preventDefault()
          }}
        >
          <LogOut aria-hidden="true" />
          {ui("sign_out")}
        </Link>
      </div>
      <div className="profile-workspace-tools">
        {caps.has("staff.area") ? (
          <StaffDrawerMenuItem
            compact
            presentation="button"
            label={ui("staff_area")}
            onOpen={onHandoff}
          />
        ) : null}
        {[
          "docs.directEdit",
          "journal.directEdit",
          "moderate.queue",
          "drives.manage",
        ].some((cap) => caps.has(cap)) ? (
          <StaffDrawerMenuItem
            compact
            drawer="editorial"
            presentation="button"
            label={ui("editorial")}
            onOpen={onHandoff}
          />
        ) : null}
        {saveActionsRef ? (
          <div ref={saveActionsRef} className="profile-workspace-save-slot" />
        ) : null}
      </div>
    </div>
  )
}

function ProfileWorkspaceSection({
  data,
  section,
  user,
  onDirtyChange,
  onRefresh,
  saveActionsTarget,
}: Props & { readonly data: Workspace }) {
  const t = useTranslations("dashboard"),
    ui = useTranslations("ui")
  const profile = data.profile
  switch (section) {
    case "settings":
      return (
        <SettingsShell
          profile={profile}
          sessionUser={user}
          avatarUrl={data.avatarUrl}
          imageUploadsEnabled={data.imageUploadsEnabled}
          embedded
          onDirtyChange={onDirtyChange}
          onSaved={onRefresh}
          saveActionsTarget={saveActionsTarget}
        />
      )
    case "notifications":
      return <NotificationInbox />
    case "membership":
      return (
        <MembershipDashboard
          embedded
          plan={user.plan ?? "free"}
          source={user.planSource ?? "none"}
          teams={sessionTeamsOf(user)}
          asOf={data.asOf}
          staffCount={staffLibrariesOf(user).length}
          recognition={
            profile
              ? {
                  listed: profile.supporterListed !== false,
                  badgeVisible: profile.supporterBadgeVisible !== false,
                  visibility: profile.profileVisibility ?? "private",
                }
              : null
          }
        />
      )
  }
  if (!profile?.username)
    return (
      <div>
        <p>{t("completeProfile")}</p>
        <button
          type="button"
          className="dashboard-navigation-link"
          onClick={() => openProfileDrawer("settings", user.id)}
        >
          {ui("complete_your_profile")}
        </button>
      </div>
    )
  switch (section) {
    case "overview":
      return (
        <div>
          {profile.bio ? (
            <p className="profile-workspace-bio">{profile.bio}</p>
          ) : null}
          <OverviewSection profile={profile} isOwner />
          {data.affiliations ? (
            <NetworkAffiliations affiliations={data.affiliations} />
          ) : null}
        </div>
      )
    case "contributions":
      return <ContributionsSection username={profile.username} isOwner />
    case "following":
      return (
        <FollowingSection
          username={profile.username}
          followedLibraries={profile.followedLibraries ?? []}
          followedDrives={data.followedDrives ?? []}
          drivesUnavailable={data.followedDrives === null}
          followedUsers={profile.followedProfiles ?? []}
          claimedLibraries={profile.claimedLibraries ?? []}
        />
      )
    case "recognition":
      return (
        <BadgesSection
          username={profile.username}
          points={profile.points}
          tier={profile.tier}
          streak={profile.streak}
          pointsThisMonth={profile.pointsThisMonth}
        />
      )
  }
}
