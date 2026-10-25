"use client"

import { useCallback, useEffect, useId } from "react"
import { flushSync } from "react-dom"

type AtlasTransition = {
  owner: string
  transition: ViewTransition
  cancel: () => void
}

let current: AtlasTransition | undefined

/** Snapshot only Atlas panels: the WebGL map must remain live and interactive. */
export function useAtlasMotion() {
  const owner = useId()
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const stop = () => {
      if (current?.owner === owner) current.transition.skipTransition()
    }
    preference.addEventListener("change", stop)

    return () => {
      preference.removeEventListener("change", stop)
      if (current?.owner === owner) current.cancel()
    }
  }, [owner])

  return useCallback(
    (update: () => void) => {
      current?.cancel()
      if (
        !document.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        update()

        return
      }

      let cancelled = false
      let committed = false
      const commit = () => {
        if (cancelled || committed) return
        committed = true
        flushSync(update)
      }
      document.documentElement.dataset.atlasTransition = ""
      const clean = () => {
        if (current?.transition !== transition) return
        current = undefined
        delete document.documentElement.dataset.atlasTransition
      }
      // Native snapshots avoid resizing the live panel on every animation frame.
      let transition: ViewTransition
      try {
        transition = document.startViewTransition(commit)
      } catch {
        delete document.documentElement.dataset.atlasTransition
        commit()

        return
      }
      current = {
        owner,
        transition,
        cancel: () => {
          cancelled = true
          transition.skipTransition()
          clean()
        },
      }
      // Duplicate names, a hidden document or browser cancellation must not
      // prevent the user's update or leave an unhandled promise rejection.
      transition.ready.catch(() => {})
      transition.updateCallbackDone.catch(() => {})
      transition.finished.then(clean, clean)
    },
    [owner]
  )
}
