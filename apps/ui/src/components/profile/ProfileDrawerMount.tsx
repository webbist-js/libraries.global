"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { usePathname, useRouter } from "@/lib/navigation"
import {
  openProfileDrawer,
  PROFILE_SECTIONS,
  useProfileDrawer,
} from "@/lib/profile-drawer"

const ProfileDrawer = dynamic(() => import("./ProfileDrawer"), { ssr: false })

/** Load forms/billing/security only after the account workspace is requested. */
export function ProfileDrawerMount() {
  const state = useProfileDrawer()
  const { data, isPending, error } = useHydratedSession()
  const path = usePathname()
  const router = useRouter()
  const [activated, setActivated] = useState(false)
  useEffect(() => {
    if (isPending || error) return
    const url = new URL(window.location.href)
    const section = PROFILE_SECTIONS.find(
      (value) => value === url.searchParams.get("account")
    )
    if (!section) return
    if (!data?.user) {
      router.replace(
        `/auth/signin?callbackUrl=${encodeURIComponent(url.pathname + url.search + url.hash)}`
      )

      return
    }
    openProfileDrawer(
      section,
      data.user.id,
      null,
      url.hash.slice(1) || undefined
    )
    url.searchParams.delete("account")
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash
    )
  }, [data?.user, error, isPending, path, router])
  if (state.open && !activated) setActivated(true)

  return activated ? <ProfileDrawer /> : null
}
