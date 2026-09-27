"use client"

import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import type { ClaimedLibrary } from "@/app/api/profile/me/affiliations/route"
import { authClient } from "@/lib/auth-client"
import {
  buildContributorShortcuts,
  type ContributorShortcutGroup,
} from "@/lib/contributor-shortcuts"

const CMS_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? null

const noop = () => () => {}

/**
 * Role-specific shortcuts for the signed-in user. Claimed library names are
 * fetched only for people who can edit a library, and shared (one request)
 * between the header, mobile menu and footer.
 */
export function useContributorShortcuts(): ContributorShortcutGroup[] {
  // The server renders no shortcuts (static pages have no session), so the
  // client must match that until hydration is done, even if the session
  // has already resolved.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
  const { data } = authClient.useSession()
  const capabilities = (data?.user?.capabilities ?? []) as string[]
  const canEditLibrary = capabilities.includes("submit.libraryEdit")

  const { data: claimedLibraries = [] } = useQuery({
    queryKey: ["my-affiliations", data?.user?.id],
    enabled: canEditLibrary,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/profile/me/affiliations")
      if (!res.ok) return []
      const json = (await res.json()) as { libraries?: ClaimedLibrary[] }

      return json.libraries ?? []
    },
  })

  if (!hydrated) return []

  return buildContributorShortcuts({
    capabilities,
    claimedLibraries,
    cmsUrl: CMS_URL,
  })
}
