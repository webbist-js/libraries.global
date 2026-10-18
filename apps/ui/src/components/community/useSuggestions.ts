"use client"

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { authClient } from "@/lib/auth-client"
import type {
  PublicSuggestion,
  SuggestionReviewRound,
} from "@/lib/community/suggestions"

type BoardReply = {
  data?: PublicSuggestion[]
  round?: SuggestionReviewRound | null
}

export function useSuggestions(
  initial: PublicSuggestion[],
  initialRound?: SuggestionReviewRound | null
) {
  const { data: session, isPending } = authClient.useSession()
  const viewerScope = isPending ? "pending" : (session?.user?.id ?? "anonymous")
  const scope = useRef(viewerScope)
  scope.current = viewerScope
  const [items, setItemsState] = useState(initial)
  const [itemScope, setItemScope] = useState(viewerScope)
  const [round, setRound] = useState(initialRound ?? null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const localChanges = useRef(0)

  useEffect(() => {
    localChanges.current += 1
    setItemScope(viewerScope)
    setItemsState(
      initial
        .filter((s) => (s.publicationStatus ?? "published") === "published")
        .map((s) => ({ ...s, voted: undefined }))
    )
    setBusyId(null)
    setError(null)
    if (isPending) return
    const controller = new AbortController()
    const refresh = () => {
      const seen = localChanges.current
      fetch("/api/option-suggestions", {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
        )
        .then((json: BoardReply) => {
          if (
            !controller.signal.aborted &&
            scope.current === viewerScope &&
            seen === localChanges.current
          ) {
            if (json.data) setItemsState(json.data)
            if (json.round !== undefined) setRound(json.round)
          }
        })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 60000)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [viewerScope, isPending, initial])

  const setItems = useCallback((next: SetStateAction<PublicSuggestion[]>) => {
    localChanges.current += 1
    setItemsState(next)
  }, [])

  const vote = useCallback(async (suggestion: PublicSuggestion) => {
    const actor = scope.current
    localChanges.current += 1
    setBusyId(suggestion.documentId)
    setError(null)
    try {
      const res = await fetch(
        `/api/option-suggestions/${encodeURIComponent(suggestion.documentId)}/vote`,
        { method: "POST" }
      )
      const json = await res.json().catch(() => ({}))
      if (scope.current !== actor) return null
      if (!res.ok || !json.data) {
        setError(
          typeof json.error === "string"
            ? json.error
            : (json.error?.message ??
                "Your vote didn’t save. Please try again.")
        )

        return null
      }
      const { voted, votes } = json.data as { voted: boolean; votes: number }
      const seen = ++localChanges.current
      setItemsState((list) =>
        list.map((s) =>
          s.documentId === suggestion.documentId ? { ...s, voted, votes } : s
        )
      )
      const latest = await fetch("/api/option-suggestions", {
        cache: "no-store",
      })
        .then((r) => (r.ok ? (r.json() as Promise<BoardReply>) : null))
        .catch(() => null)
      if (scope.current === actor && seen === localChanges.current && latest) {
        if (latest.data) setItemsState(latest.data)
        if (latest.round !== undefined) setRound(latest.round)
      }

      return { voted, votes }
    } catch {
      if (scope.current === actor) setError("Network error. Please try again.")

      return null
    } finally {
      if (scope.current === actor) setBusyId(null)
    }
  }, [])

  const visibleItems =
    itemScope === viewerScope
      ? items
      : initial
          .filter(
            (item) => (item.publicationStatus ?? "published") === "published"
          )
          .map((item) => ({ ...item, voted: undefined }))

  return {
    items: visibleItems,
    round,
    setItems,
    vote,
    busyId,
    error,
    viewerScope,
    signedIn: !isPending && Boolean(session?.user),
    ready: !isPending,
  }
}
