"use client"

import { useCallback, useEffect, useState } from "react"

import {
  articleCopyKey,
  readArticleCopy,
  saveArticleCopy,
  removeArticleCopy,
  type ArticleLocalCopy,
} from "@/lib/article-local-recovery"

import type { ArticleDraft } from "./article.types"

/** Private copies are isolated by authenticated actor, target and content language. */
export function useArticleRecovery(
  owner: string | undefined,
  target: string,
  locale: string
) {
  const key = owner ? articleCopyKey(owner, target, locale) : null
  const [candidate, setCandidate] = useState<ArticleLocalCopy | null>(null)
  const [storageFailed, setStorageFailed] = useState(false)
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const timer = setTimeout(
      () => setCandidate(key && owner ? readArticleCopy(key, owner) : null),
      0
    )

    return () => clearTimeout(timer)
  }, [key, owner])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    const changed = (event: StorageEvent) => {
      if (key && owner && event.key === key)
        setCandidate(readArticleCopy(key, owner))
    }
    window.addEventListener("storage", changed)

    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      window.removeEventListener("storage", changed)
    }
  }, [key, owner])
  const store = useCallback(
    (
      draft: ArticleDraft,
      submissionId: string | null,
      baseRevision: string | null
    ) => {
      if (!key || !owner) return
      setStorageFailed(
        !saveArticleCopy(key, {
          owner,
          target,
          locale,
          submissionId,
          baseRevision,
          writtenAt: new Date().toISOString(),
          draft,
        })
      )
    },
    [key, owner, target, locale]
  )
  const discard = useCallback(() => {
    if (key) removeArticleCopy(key)
    setCandidate(null)
  }, [key])

  return {
    key,
    candidate,
    online,
    storageFailed,
    store,
    discard,
    dismiss: () => setCandidate(null),
  }
}
