"use client"

import { profilePalette } from "@repo/shared-data"
import { CalendarDays, Globe, MapPin, Pencil, ShieldCheck } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { ProfileAvatar } from "@/components/ds/ProfileAvatar"
import { Button } from "@/components/ui/button"
import type { BetterAuthUser } from "@/lib/auth-server"
import { avatarInitials, avatarSrc } from "@/lib/avatar"
import { Link } from "@/lib/navigation"
import { closeProfileDrawer, openProfileDrawer } from "@/lib/profile-drawer"
import type { UserProfile } from "@/lib/types/profile"

function countryName(country: string | null | undefined, locale: string) {
  if (!country) return null
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(
        country.toUpperCase()
      ) ?? country
    )
  } catch {
    return country
  }
}

/** The same identity and primary actions on every account section. */
export function ProfileWorkspaceHeader({
  user,
  profile,
  avatarUrl,
}: {
  readonly user: BetterAuthUser
  readonly profile?: UserProfile | null
  readonly avatarUrl?: string | null
}) {
  const t = useTranslations("dashboard")
  const ui = useTranslations("ui")
  const format = useFormatter()
  const locale = useLocale()
  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    user.name ||
    profile?.username ||
    ui("your_profile")
  const image = avatarUrl ?? avatarSrc(profile?.avatar) ?? user.image
  const palette = profilePalette(profile?.profileBackground)
  const location = [profile?.city, countryName(profile?.country, locale)]
    .filter(Boolean)
    .join(", ")
  const joined = profile?.createdAt ? new Date(profile.createdAt) : null

  return (
    <div className="profile-workspace-header">
      <div className="profile-workspace-identity">
        <ProfileAvatar
          className="profile-workspace-avatar"
          src={image}
          initials={avatarInitials(name)}
          size="css"
          palette={palette}
        />
        <div className="profile-workspace-identity-copy">
          <h3 className="type-h3">{name}</h3>
          <div className="profile-workspace-meta">
            {profile?.username ? <span>@{profile.username}</span> : null}
            {location ? (
              <span>
                <MapPin size={16} aria-hidden="true" />
                {location}
              </span>
            ) : null}
            {joined && Number.isFinite(joined.getTime()) ? (
              <span className="profile-workspace-joined">
                <CalendarDays size={16} aria-hidden="true" />
                {t("memberSince", {
                  date: format.dateTime(joined, {
                    month: "short",
                    year: "numeric",
                  }),
                })}
              </span>
            ) : null}
            {profile?.isVerifiedLibrarian ? (
              <span className="profile-workspace-verified">
                <ShieldCheck size={16} aria-hidden="true" />
                {ui("verified_staff")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="profile-workspace-primary-actions">
        <Button
          variant="primary"
          size="pill"
          onClick={() => openProfileDrawer("settings", user.id)}
        >
          <Pencil aria-hidden="true" />
          {t("editProfile")}
        </Button>
        {profile?.username ? (
          <Button variant="surface" size="pill" asChild>
            <Link
              publicProfile
              href={`/profile/${profile.username}`}
              onNavigate={(event) => {
                if (!closeProfileDrawer()) event.preventDefault()
              }}
            >
              <Globe aria-hidden="true" />
              {t("viewPublicProfile")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
