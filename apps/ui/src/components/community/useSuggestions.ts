"use client"

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { authClient } from "@/lib/auth-client"
import type { PublicSuggestion } from "@/lib/community/suggestions"

type VoteReply = {
  data?: { voted: boolean; votes: number }
  error?: string | { message?: string }
}

/**
 * Option Suggestions on the client: the server-rendered list, refetched
 * once the session is known so a signed-in viewer sees their own votes,
 * and votes sent through `POST /api/option-suggestions/{id}/vote`.
 *
 * Every local change (a vote, or `setItems`) bumps a counter, so a list
 * requested before it can't land on top of it.
 */
export function useSuggestions(initial: PublicSuggestion[]) {
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const [items, setItemsState] = useState<PublicSuggestion[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const localChanges = useRef(0)

  useEffect(() => {
    // The server-rendered list carries no `voted`; only a signed-in viewer
    // has votes to pick up.
    if (isPending || !signedIn) return
    let live = true
    const seen = localChanges.current
    fetch("/api/option-suggestions", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json: { data?: PublicSuggestion[] }) => {
        if (live && seen === localChanges.current && json.data)
          setItemsState(json.data)
      })
      // Keep the server-rendered list when the refetch fails.
      .catch(() => {})

    return () => {
      live = false
    }
  }, [isPending, signedIn])

  const setItems = useCallback((next: SetStateAction<PublicSuggestion[]>) => {
    localChanges.current += 1
    setItemsState(next)
  }, [])

  const vote = useCallback(async (s: PublicSuggestion) => {
    localChanges.current += 1
    setBusyId(s.documentId)
    setError(null)
    try {
      const res = await fetch(`/api/option-suggestions/${s.documentId}/vote`, {
        method: "POST",
      })
      const json = (await res.json().catch(() => ({}))) as VoteReply
      if (!res.ok || !json.data) {
        const message =
          typeof json.error === "string" ? json.error : json.error?.message
        setError(message ?? "Your vote didn’t save. Please try again.")

        return null
      }
      const { voted, votes } = json.data
      localChanges.current += 1
      setItemsState((list) =>
        list.map((x) =>
          x.documentId === s.documentId ? { ...x, voted, votes } : x
        )
      )

      return { voted, votes }
    } catch {
      setError("Network error. Please try again.")

      return null
    } finally {
      setBusyId(null)
    }
  }, [])

  return {
    items,
    setItems,
    vote,
    busyId,
    error,
    signedIn,
    /** False until the session is known: sign-in links wait for it. */
    ready: !isPending,
  }
}
