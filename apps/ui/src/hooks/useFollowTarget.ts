"use client"

import { useEffect, useRef, useState } from "react"

type TargetKind = "libraryDocumentId" | "driveDocumentId"
type Result = {
  key: string
  following: boolean | null
  error: "read" | "write" | null
}

/** Unknown status stays unknown; account/target changes invalidate all responses. */
export function useFollowTarget(
  userId: string | undefined,
  kind: TargetKind,
  id: string
) {
  const key = JSON.stringify([userId, kind, id])
  const [result, setResult] = useState<Result | null>(null)
  const [revision, setRevision] = useState(0)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const saving = savingKey === key
  const write = useRef<AbortController | null>(null)
  const current = result?.key === key ? result : null
  useEffect(() => {
    const controller = new AbortController()
    if (userId && id) {
      fetch(`/api/profile/me/follow?${kind}=${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Follow unavailable")
          const body: unknown = await response.json()
          if (
            !body ||
            typeof body !== "object" ||
            !("following" in body) ||
            typeof body.following !== "boolean"
          )
            throw new Error("Invalid follow status")
          if (!controller.signal.aborted)
            setResult({ key, following: body.following, error: null })
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ key, following: null, error: "read" })
        })
    }

    return () => {
      controller.abort()
      write.current?.abort()
    }
  }, [userId, kind, id, key, revision])
  const retry = () => {
    setResult(null)
    setRevision((value) => value + 1)
  }
  const toggle = async () => {
    if (!userId || !current || current.following === null || saving) return null
    const controller = new AbortController()
    write.current = controller
    setSavingKey(key)
    try {
      const response = await fetch("/api/profile/me/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          [kind]: id,
          action: current.following ? "unfollow" : "follow",
        }),
      })
      if (!response.ok) throw new Error("Follow update unavailable")
      const body: unknown = await response.json()
      if (
        !body ||
        typeof body !== "object" ||
        !("following" in body) ||
        typeof body.following !== "boolean"
      )
        throw new Error("Invalid follow update")
      if (controller.signal.aborted) return null
      setResult({ key, following: body.following, error: null })

      return body.following
    } catch {
      if (!controller.signal.aborted)
        setResult({ key, following: current.following, error: "write" })

      return null
    } finally {
      if (!controller.signal.aborted) setSavingKey(null)
    }
  }

  return {
    following: current?.following ?? null,
    error: current?.error ?? null,
    saving,
    retry,
    toggle,
  }
}
