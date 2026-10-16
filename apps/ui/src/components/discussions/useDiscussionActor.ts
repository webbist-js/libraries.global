"use client"

import { useEffect, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"

import { discussionRequest } from "./api"

/** Session identity isolates private data; the host projects discussion-specific scope. */
export function useDiscussionActor() {
  const { data, isPending } = useHydratedSession()
  const identity = data?.user?.id ?? "guest"
  const grants = JSON.stringify(
    (data?.user as { moderationScopes?: unknown } | undefined)?.moderationScopes
  )
  const scope = `${identity}:${grants}`
  const [access, setAccess] = useState<{
    scope: string
    signedIn: boolean
    canModerate: boolean
  } | null>(null)
  useEffect(() => {
    if (isPending) return
    let cancelled = false
    discussionRequest<{ signedIn: boolean; canModerate: boolean }>("session")
      .then((hint) => {
        if (!cancelled) setAccess({ scope, ...hint })
      })
      .catch(() => {
        if (!cancelled)
          setAccess({ scope, signedIn: false, canModerate: false })
      })

    return () => {
      cancelled = true
    }
  }, [scope, grants, isPending])
  const ready = !isPending && access?.scope === scope

  return {
    scope,
    ready,
    signedIn: ready && Boolean(data?.user) && access.signedIn,
    canModerate: ready && Boolean(data?.user) && access.canModerate,
  }
}
