import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import type { ProfileNetworkAffiliation } from "@/components/networks/NetworkAffiliations"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import { loadFollowedDriveViews } from "@/lib/drives/followed-drives-server"
import { readPublicNetwork } from "@/lib/networks/server"
import { readOwnProfile } from "@/lib/own-profile-server"

/** Owner data only; the session determines identity, never a supplied username. */
export async function GET(request: Request) {
  const session = await getSessionSSR(await headers())
  const privateHeaders = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
  }
  if (!session?.user)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders }
    )
  const lookup = await readOwnProfile(session.user)
  if (!lookup.ok && lookup.reason === "unavailable")
    return NextResponse.json(
      { error: "Profile unavailable" },
      { status: 503, headers: privateHeaders }
    )
  const profile = lookup.ok ? lookup.profile : null
  const requestedLocale = new URL(request.url).searchParams.get("locale")
  const locale =
    SUPPORTED_LOCALES.find((value) => value === requestedLocale) ?? "en"
  const [followedDrives, networks] = await Promise.all([
    loadFollowedDriveViews(profile?.followedDrives ?? [], locale).catch(
      () => null
    ),
    profile?.username
      ? readPublicNetwork<{ affiliations: ProfileNetworkAffiliation[] }>(
          `network-affiliations/${encodeURIComponent(profile.username)}`
        ).catch(() => null)
      : Promise.resolve({ affiliations: [] }),
  ])

  return NextResponse.json(
    {
      actorId: session.user.id,
      asOf: Date.now(),
      profile,
      avatarUrl: avatarSrc(profile?.avatar),
      imageUploadsEnabled: Boolean(process.env.STRAPI_UPLOAD_API_KEY),
      followedDrives,
      affiliations: networks?.affiliations ?? null,
    },
    { headers: privateHeaders }
  )
}
