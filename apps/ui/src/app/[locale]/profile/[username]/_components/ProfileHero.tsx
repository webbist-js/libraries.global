import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import GlobalLink from "@/components/global/GlobalLink"
import { avatarSrc } from "@/lib/avatar"
import { T } from "@/lib/design-tokens"
import { resolvePublicPrefs, type UserProfile } from "@/lib/types/profile"

import { ProfileFollowButton } from "./ProfileFollowButton"

function countryName(code?: string | null): string | null {
  if (!code) return null
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        code.toUpperCase()
      ) ?? code
    )
  } catch {
    return code
  }
}

function getInitials(p: UserProfile): string {
  const first = p.firstName?.[0] ?? ""
  const last = p.lastName?.[0] ?? ""

  return (first + last).toUpperCase() || p.username.slice(0, 2).toUpperCase()
}

function MetaItem({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon
        icon={icon}
        width={18}
        height={18}
        aria-hidden="true"
        style={{ color: T.ink.low }}
      />
      {children}
    </span>
  )
}

function RoleCard({
  icon,
  bg,
  fg,
  title,
  note,
}: {
  icon: string
  bg: string
  fg: string
  title: ReactNode
  note?: ReactNode
}) {
  return (
    <div
      className="inline-flex items-center gap-3.5 rounded-[16px] border py-3 pr-5 pl-3.5"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: bg, color: fg }}
      >
        <Icon icon={icon} width={20} height={20} aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span
          className="text-[16px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {title}
        </span>
        {note ? (
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            {note}
          </span>
        ) : null}
      </span>
    </div>
  )
}

export function ProfileHero({
  profile,
  isOwnProfile,
  isSignedIn,
  tabs,
}: {
  profile: UserProfile
  isOwnProfile: boolean
  isSignedIn: boolean
  /** Section tabs (`ProfileTabNav`) on the band's bottom edge. */
  tabs?: ReactNode
}) {
  const initials = getInitials(profile)
  const avatar = avatarSrc(profile.avatar, "lg")
  const prefs = resolvePublicPrefs(profile.publicPrefs)
  const showAffiliation = isOwnProfile || prefs.showAffiliation
  const showLocation = isOwnProfile || prefs.showLocation
  const location = [profile.city, countryName(profile.country)]
    .filter(Boolean)
    .join(", ")
  // Prefer the verified claimed library (canonical name + link) over free-text affiliation
  const staffLibrary = profile.claimedLibraries?.find((l) => l.name)
  const affiliationName = staffLibrary?.name ?? profile.affiliation
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.username

  const joined = new Date(profile.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  return (
    <section
      className="border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 sm:px-8 sm:pt-10">
        <Breadcrumb
          className="mb-5"
          items={[
            { label: "Home", href: "/" },
            { label: "Community", href: "/community" },
            { label: `@${profile.username}` },
          ]}
        />

        {/* Hero row */}
        <div className="flex flex-wrap items-start gap-7 pb-8">
          {/* Avatar */}
          <div
            className="flex size-[80px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[32px] sm:size-[128px] sm:text-[50px]"
            style={{
              background: "var(--tint-national-bg)",
              color: "var(--tint-national-fg)",
              fontFamily: T.font.serif,
              fontWeight: 500,
            }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>

          {/* Identity */}
          {/* Wraps under the avatar on narrow screens */}
          <div className="min-w-0 flex-1 basis-[min(100%,420px)]">
            <h1
              className="m-0"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(42px, 5.4vw, 68px)",
                fontWeight: 500,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                color: T.ink.base,
              }}
            >
              {displayName}
            </h1>

            <p
              className="mt-3 mb-0 flex flex-wrap gap-x-7 gap-y-1.5 text-[16px]"
              style={{ color: T.ink.dim }}
            >
              <MetaItem icon="mdi:at">{profile.username}</MetaItem>
              <MetaItem icon="mdi:calendar-blank-outline">
                Contributor since {joined}
              </MetaItem>
              {showLocation && location ? (
                <MetaItem icon="mdi:map-marker-outline">{location}</MetaItem>
              ) : null}
            </p>

            {profile.bio ? (
              <p
                className="mt-3 mb-0 max-w-[64ch] text-[17px] leading-[1.55]"
                style={{ color: T.ink.base }}
              >
                {profile.bio}
              </p>
            ) : null}

            {/* Role cards */}
            <div className="mt-5 flex flex-wrap gap-3">
              {profile.supporterMark ? (
                <RoleCard
                  icon="mdi:heart-outline"
                  bg="var(--tint-national-bg)"
                  fg="var(--tint-national-fg)"
                  title="Supporter"
                />
              ) : null}
              {profile.isVerifiedLibrarian ? (
                <RoleCard
                  icon="mdi:shield-check-outline"
                  bg="var(--tint-public-bg)"
                  fg="var(--tint-public-fg)"
                  title={
                    <>
                      Verified staff
                      {affiliationName && showAffiliation ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="sr-only">at </span>
                          {staffLibrary?.path ? (
                            <GlobalLink
                              href={staffLibrary.path}
                              className="font-medium underline underline-offset-4"
                              style={{ color: T.accent.primary }}
                            >
                              {affiliationName}
                            </GlobalLink>
                          ) : (
                            <span className="font-medium">
                              {affiliationName}
                            </span>
                          )}
                        </>
                      ) : null}
                    </>
                  }
                  note="Confirmed by the review team via work email"
                />
              ) : null}
              <RoleCard
                icon="mdi:account-group-outline"
                bg="var(--tint-national-bg)"
                fg="var(--tint-national-fg)"
                title="Community contributor"
              />
            </div>
          </div>

          {/* Actions */}
          {!isOwnProfile && profile.profileVisibility === "public" && (
            <div className="shrink-0 pt-2">
              <ProfileFollowButton
                targetUsername={profile.username}
                isSignedIn={isSignedIn}
              />
            </div>
          )}
        </div>
        {tabs}
      </div>
    </section>
  )
}
