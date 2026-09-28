"use client"

import { useEffect, useState } from "react"

import {
  LIBRARY_FOLLOW_EVENT,
  type LibraryFollowDetail,
} from "@/components/library/follow-events"

/** "1 follower", "12 followers", "No followers yet". */
export function followerLabel(count: number): string {
  if (count <= 0) return "No followers yet"

  return `${count.toLocaleString("en-GB")} ${count === 1 ? "follower" : "followers"}`
}

/**
 * The sidebar's follower count. Starts from the server's (cached) count and
 * moves by one when the reader follows or unfollows on this page.
 */
export function LibraryFollowerCount({
  initial,
  libraryDocumentId,
}: {
  readonly initial: number
  readonly libraryDocumentId: string
}) {
  const [count, setCount] = useState(initial)

  useEffect(() => {
    const onFollow = (e: Event) => {
      const { detail } = e as CustomEvent<LibraryFollowDetail>
      if (detail.libraryDocumentId !== libraryDocumentId) return
      setCount((n) => Math.max(0, n + (detail.following ? 1 : -1)))
    }
    window.addEventListener(LIBRARY_FOLLOW_EVENT, onFollow)

    return () => window.removeEventListener(LIBRARY_FOLLOW_EVENT, onFollow)
  }, [libraryDocumentId])

  return <span aria-live="polite">{followerLabel(count)}</span>
}
