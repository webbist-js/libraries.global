"use client"

import { profilePalette, type ProfileBackground } from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { ProfileAvatar } from "@/components/ds/ProfileAvatar"
import { useNotifications } from "@/components/notifications/NotificationProvider"
import type { BetterAuthUser } from "@/lib/auth-server"
import { avatarInitials } from "@/lib/avatar"
import { openProfileDrawer, useProfileDrawer } from "@/lib/profile-drawer"

/** The avatar and unread shortcut open sections of the same account workspace. */
export function ProfileDrawerTrigger({
  user,
  profileSnippet,
}: {
  readonly user: BetterAuthUser
  readonly profileSnippet?: {
    avatarUrl?: string | null
    profileBackground?: ProfileBackground | null
    username?: string | null
    isVerifiedLibrarian?: boolean | null
  } | null
}) {
  const t = useTranslations("ui")
  const d = useTranslations("dashboard")
  const state = useProfileDrawer()
  const { unread } = useNotifications()

  return (
    <span className="profile-trigger-group">
      <button
        type="button"
        aria-label={`${avatarInitials(user.name || user.email)} · ${t("your_profile")}`}
        title={t("your_profile")}
        aria-haspopup="dialog"
        aria-expanded={state.open && state.actor === user.id}
        className="dashboard-rail-item dashboard-square profile-trigger"
        onClick={(event) =>
          openProfileDrawer("overview", user.id, event.currentTarget)
        }
      >
        <span className="relative inline-flex">
          <ProfileAvatar
            src={profileSnippet?.avatarUrl ?? user.image}
            initials={avatarInitials(user.name || user.email)}
            size={48}
            palette={profilePalette(profileSnippet?.profileBackground)}
            className="text-lg font-bold"
          />
        </span>
      </button>
      {unread > 0 ? (
        <button
          type="button"
          className="profile-notifications-trigger"
          aria-label={d("unreadNotifications", { count: unread })}
          title={d("unreadNotifications", { count: unread })}
          aria-haspopup="dialog"
          aria-expanded={
            state.open &&
            state.actor === user.id &&
            state.section === "notifications"
          }
          onClick={(event) =>
            openProfileDrawer("notifications", user.id, event.currentTarget)
          }
        >
          <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
        </button>
      ) : null}
    </span>
  )
}
export default ProfileDrawerTrigger
