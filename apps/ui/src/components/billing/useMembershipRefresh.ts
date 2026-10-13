"use client"

import { useCallback } from "react"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "@/lib/navigation"

/** Refresh verified access in the reactive session and server-rendered UI. */
export function useMembershipRefresh() {
  const { refetch } = authClient.useSession()
  const router = useRouter()

  return useCallback(async () => {
    await refetch({ query: { disableCookieCache: true } })
    router.refresh()
  }, [refetch, router])
}
