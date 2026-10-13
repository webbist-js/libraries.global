import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import GlobalLink from "@/components/global/GlobalLink"
import { avatarSrc } from "@/lib/avatar"
import { KOFI_URL } from "@/lib/constants"
import { T } from "@/lib/design-tokens"
import { isFounder } from "@/lib/founder"
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

/**
 * Role cards for the derived `contributorRole`. Verified staff has its own
 * card (from `isVerifiedLibrarian`); readers and contributors get none.
 */
const ROLE_CARDS: Record<
  string,
  { icon: string; title: string; note: string; tint: string }
> = {
  editorial_board: {
    icon: "mdi:bookshelf",
    title: "Editorial board",
    note: "Reviews every queue and language",
    tint: "national",
  },
  moderator: {
    icon: "mdi:shield-account-outline",
    title: "Moderator",
    note: "Reviews community changes",
    tint: "academic",
  },
  wiki_editor: {
    icon: "mdi:book-open-page-variant-outline",
    title: "Knowledge editor",
    note: "Edits the Knowledge base",
    tint: "public",
  },
  journal_editor: {
    icon: "mdi:newspaper-variant-outline",
    title: "Journal editor",
    note: "Edits the Journal",
    tint: "public",
  },
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
  const tUi = useUiTranslations("ui")

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
  const roleCard = profile.contributorRole
    ? ROLE_CARDS[profile.contributorRole]
    : undefined
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
            { label: tUi("home"), href: "/" },
            { label: tUi("community"), href: "/community" },
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
              {typeof profile.followerCount === "number" ? (
                <MetaItem icon="mdi:account-multiple-outline">
                  {profile.followerCount.toLocaleString("en-GB")}{" "}
                  {profile.followerCount === 1 ? "follower" : "followers"}
                </MetaItem>
              ) : null}
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
              {isFounder(profile.username) ? (
                <RoleCard
                  icon="mdi:star-four-points-outline"
                  bg="var(--tint-special-bg)"
                  fg="var(--tint-special-fg)"
                  title={tUi("founder")}
                  note="Started Libraries Global"
                />
              ) : null}
              {roleCard ? (
                <RoleCard
                  icon={roleCard.icon}
                  bg={`var(--tint-${roleCard.tint}-bg)`}
                  fg={`var(--tint-${roleCard.tint}-fg)`}
                  title={roleCard.title}
                  note={roleCard.note}
                />
              ) : null}
              {profile.supporterMark ? (
                <RoleCard
                  icon="mdi:heart-outline"
                  bg="var(--tint-national-bg)"
                  fg="var(--tint-national-fg)"
                  title={tUi("supporter")}
                />
              ) : null}
              {profile.isVerifiedLibrarian ? (
                <RoleCard
                  icon="mdi:shield-check-outline"
                  bg="var(--tint-public-bg)"
                  fg="var(--tint-public-fg)"
                  title={
                    <>
                      {tUi("verified_staff")}
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
                title={tUi("community_contributor")}
              />
            </div>

            {isFounder(profile.username) ? (
              <GlobalLink
                href={KOFI_URL}
                className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[15px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary)"
                style={{ borderColor: T.border.hi }}
              >
                <Icon icon="simple-icons:kofi" className="size-4" aria-hidden />
                {tUi("buy_me_a_coffee")}
                <span className="sr-only"> {tUi("opens_in_a_new_tab")}</span>
              </GlobalLink>
            ) : null}
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
