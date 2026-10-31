"use client"

import { useEffect } from "react"

import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { useHydratedSession } from "@/lib/access-client"

/** Kept outside the lightweight appearance provider so public/preview roots need no auth. */
export function AccountAppearanceSync() {
  const appearance = useAppearance()
  const { data, isPending, error } = useHydratedSession()
  const actor = data?.user?.id ?? null
  const controller = appearance?.controller
  const ready = appearance?.ready && appearance.enabled
  useEffect(() => {
    if (!ready || !controller || isPending || error) return
    controller.setActor(actor)
  }, [actor, ready, controller, isPending, error])

  return null
}
