import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { loadFollowedDriveViews } from "@/lib/drives/followed-drives-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import {
  fetchPublicProfile as fetchProfile,
  profileForViewer,
} from "@/lib/public-profile-server"

import { FollowingSection } from "../_components/sections/FollowingSection"

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>
}) {
  const { locale, username } = await params
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

  // Empty when the owner hides their follows (Strapi sends none).
  const followedDrives = await loadFollowedDriveViews(
    profile.followedDrives ?? [],
    locale
  )

  return (
    <FollowingSection
      username={username}
      followedLibraries={profile.followedLibraries ?? []}
      followedDrives={followedDrives}
      followedUsers={profile.followedProfiles ?? []}
      claimedLibraries={profile.claimedLibraries ?? []}
    />
  )
}
