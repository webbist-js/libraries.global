"use client"

import { useEffect } from "react"

/** Warn on browser exits and link navigation. The wizard retains Back/Forward work in its account-scoped memory cache. */
export function useUnsavedNavigation(
  dirty: boolean,
  message: string,
  committed: React.RefObject<boolean>
) {
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (committed.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    const click = (event: MouseEvent) => {
      if (
        committed.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link =
        event.target instanceof Element ? event.target.closest("a[href]") : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return
      const destination = new URL(link.href, window.location.href)
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", click, true)

    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", click, true)
    }
  }, [dirty, message, committed])
}
