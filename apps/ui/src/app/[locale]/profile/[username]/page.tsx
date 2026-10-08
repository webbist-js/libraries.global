import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { ProfilePrivacyControls } from "@/app/[locale]/profile/[username]/_components/ProfilePrivacyControls"
import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import type { UserProfile } from "@/lib/types/profile"

import { OverviewSection } from "./_components/sections/OverviewSection"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET

async function fetchProfile(
  username: string,
  opts?: { ownerBaUserId?: string; viewerBaUserId?: string }
): Promise<UserProfile | null> {
  try {
    let url = `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}`
    const reqHeaders: Record<string, string> = {}
    if (BRIDGE_SECRET && (opts?.ownerBaUserId ?? opts?.viewerBaUserId)) {
      const params = new URLSearchParams()
      if (opts?.ownerBaUserId) params.set("ownerBaUserId", opts.ownerBaUserId)
      if (opts?.viewerBaUserId)
        params.set("viewerBaUserId", opts.viewerBaUserId)
      url += `?${params.toString()}`
      reqHeaders["X-Service-Secret"] = BRIDGE_SECRET
    }
    const res = await fetch(url, { cache: "no-store", headers: reqHeaders })
    if (!res.ok) return null
    const json = (await res.json()) as { data: UserProfile }

    return json.data
  } catch {
    return null
  }
}

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
          className="text-[15px] font-semibold underline underline-offset-4"
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

  let profile: UserProfile | null = publicProfile
  let isOwner = false

  if (session?.user?.id) {
    const ownProfile = await fetchOwnProfile(session.user)
    isOwner = ownProfile?.username === username

    if (!profile) {
      if (isOwner) {
        profile = await fetchProfile(username, {
          ownerBaUserId: session.user.id,
        })
      }
    } else if (profile.profileVisibility === "limited") {
      const expanded = await fetchProfile(username, {
        [isOwner ? "ownerBaUserId" : "viewerBaUserId"]: session.user.id,
      })
      if (expanded) profile = expanded
    }
  }

  if (!profile) notFound()

  return (
    <>
      {isOwner ? <ProfileOverviewBanner profile={profile} /> : null}
      <OverviewSection profile={profile} isOwner={isOwner} />
    </>
  )
}
