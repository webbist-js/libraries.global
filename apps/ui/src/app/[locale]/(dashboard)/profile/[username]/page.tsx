import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { ProfilePrivacyControls } from "@/app/[locale]/profile/[username]/_components/ProfilePrivacyControls"
import { OverviewSection } from "@/app/[locale]/profile/[username]/_components/sections/OverviewSection"
import GlobalLink from "@/components/global/GlobalLink"
import { PublicNetworkAffiliations } from "@/components/networks/PublicNetworkAffiliations"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import {
  fetchPublicProfile as fetchProfile,
  profileForViewer,
} from "@/lib/public-profile-server"
import type { UserProfile } from "@/lib/types/profile"

function ProfileOverviewBanner({ profile }: { profile: UserProfile }) {
  return (
    <ProfilePrivacyControls
      initialPrefs={profile.publicPrefs}
      message={
        profile.profileVisibility === "public" ? (
          <>
            <strong style={{ color: T.accent.primaryHover }}>
              This is your public profile.
            </strong>{" "}
            Choose what others can see.
          </>
        ) : (
          <>
            <strong style={{ color: T.accent.primaryHover }}>
              This profile is {profile.profileVisibility}.
            </strong>{" "}
            Visibility can be changed in settings.
          </>
        )
      }
      actions={
        <GlobalLink
          href="/profile/settings"
          className="text-base font-semibold underline underline-offset-4"
          style={{ color: T.accent.primary }}
        >
          Edit profile
        </GlobalLink>
      }
    />
  )
}

export default async function ProfileOverviewPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const [publicProfile, session] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(await headers()),
  ])

  const user = session?.user
  const ownProfile = user?.id ? await fetchOwnProfile(user) : null
  const isOwner = ownProfile?.username === username
  const profile = await profileForViewer(
    username,
    publicProfile,
    user?.id
      ? {
          id: user.id,
          isOwner,
        }
      : undefined
  )

  if (!profile) notFound()

  return (
    <>
      {isOwner ? <ProfileOverviewBanner profile={profile} /> : null}
      <OverviewSection profile={profile} isOwner={isOwner} />
      <PublicNetworkAffiliations username={username} />
    </>
  )
}
