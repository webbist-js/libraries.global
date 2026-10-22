import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import {
  fetchPublicProfile as fetchProfile,
  profileForViewer,
} from "@/lib/public-profile-server"

import { BadgesSection } from "../_components/sections/BadgesSection"

export default async function BadgesPage({
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

  return (
    <BadgesSection
      username={username}
      points={profile?.points ?? null}
      tier={profile?.tier ?? null}
      streak={profile?.streak ?? null}
      pointsThisMonth={profile?.pointsThisMonth ?? null}
    />
  )
}
