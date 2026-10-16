"use client"

import { useEffect, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"

import { discussionRequest } from "./api"

/** Session identity isolates private data; the host projects discussion-specific scope. */
export function useDiscussionActor() {
  const { data, isPending, error } = useHydratedSession()
  const identity = data?.user?.id ?? "guest"
  const grants = JSON.stringify(
    (data?.user as { moderationScopes?: unknown } | undefined)?.moderationScopes
  )
  const scope = `${identity}:${grants}`
  const [access, setAccess] = useState<{
    scope: string
    signedIn: boolean
    canModerate: boolean
    viewerId: string | null
  } | null>(null)
  useEffect(() => {
    if (isPending || error) {
      // A failed/pending session invalidates prior verification even if its
      // cached client identity is unchanged when the network recovers.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccess(null)

      return
    }
    let cancelled = false
    discussionRequest<{
      signedIn: boolean
      canModerate: boolean
      viewerId: string | null
    }>("session")
      .then((hint) => {
        if (!cancelled) setAccess({ scope, ...hint })
      })
      .catch(() => {
        if (!cancelled) setAccess(null)
      })

    return () => {
      cancelled = true
    }
  }, [scope, grants, isPending, error])
  const ready =
    !isPending &&
    !error &&
    access?.scope === scope &&
    access.viewerId === (data?.user?.id ?? null)

  return {
    scope,
    ready,
    signedIn: ready && Boolean(data?.user) && access.signedIn,
    canModerate: ready && Boolean(data?.user) && access.canModerate,
  }
}
