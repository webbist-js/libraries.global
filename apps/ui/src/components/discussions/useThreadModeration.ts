"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  discussionRequest,
  type DiscussionAuditEvent,
  type DiscussionList,
  type DiscussionRevision,
} from "./api"

export function useThreadModeration(id: string, enabled: boolean) {
  const epoch = useRef(0)
  const [revisions, setRevisions] = useState<DiscussionRevision[]>([])
  const [audit, setAudit] = useState<DiscussionAuditEvent[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [globalTotal, setGlobalTotal] = useState<number | null>(null)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const clear = useCallback(() => {
    setRevisions([])
    setAudit([])
    setTotal(null)
    setGlobalTotal(null)
    setNextOffset(null)
  }, [])
  const reload = useCallback(async () => {
    if (!enabled) return
    const generation = ++epoch.current
    setLoading(true)
    try {
      const [queue, all, log] = await Promise.all([
        discussionRequest<DiscussionList<DiscussionRevision>>(
          `moderation/revisions?threadId=${encodeURIComponent(id)}&limit=20`
        ),
        discussionRequest<DiscussionList<DiscussionRevision>>(
          "moderation/revisions?limit=1"
        ),
        discussionRequest<DiscussionList<DiscussionAuditEvent>>(
          `moderation/threads/${encodeURIComponent(id)}/audit?limit=50`
        ),
      ])
      if (generation !== epoch.current) return
      const scoped = (queue.data ?? []).filter(
        (revision) => revision.threadId === id
      )
      setRevisions(scoped)
      setTotal(queue.total ?? scoped.length)
      setGlobalTotal(all.total ?? null)
      setNextOffset(queue.nextOffset ?? null)
      setAudit(log.data ?? [])
      setError(null)
    } catch (failure) {
      if (generation === epoch.current) {
        setError(failure)
        // Never retain a queue after a fresh authorization failure.
        clear()
      }
    } finally {
      if (generation === epoch.current) setLoading(false)
    }
  }, [id, enabled, clear])
  useEffect(() => {
    const activeEpoch = epoch
    if (enabled) void reload()
    else {
      clear()
      setError(null)
      setLoading(false)
    }

    return () => {
      activeEpoch.current++
    }
  }, [enabled, reload, clear])
  const loadMore = async () => {
    if (!enabled || nextOffset === null || loading) return
    const generation = epoch.current
    setLoading(true)
    try {
      const page = await discussionRequest<DiscussionList<DiscussionRevision>>(
        `moderation/revisions?threadId=${encodeURIComponent(id)}&limit=20&offset=${nextOffset}`
      )
      if (generation !== epoch.current) return
      setRevisions((previous) => [
        ...new Map(
          [
            ...previous,
            ...page.data.filter((revision) => revision.threadId === id),
          ].map((revision) => [revision.id, revision])
        ).values(),
      ])
      setNextOffset(page.nextOffset ?? null)
    } catch (failure) {
      if (generation === epoch.current) {
        setError(failure)
        clear()
      }
    } finally {
      if (generation === epoch.current) setLoading(false)
    }
  }

  return {
    revisions,
    audit,
    total,
    globalTotal,
    nextOffset,
    loading,
    error,
    reload,
    loadMore,
  }
}
