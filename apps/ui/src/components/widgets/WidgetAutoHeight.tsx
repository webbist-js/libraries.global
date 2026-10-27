"use client"

import { useEffect } from "react"

export function WidgetAutoHeight({
  publicId,
  origins,
}: {
  readonly publicId: string
  readonly origins: string[]
}) {
  useEffect(() => {
    if (window.parent === window) return
    let target: string
    try {
      target = new URL(document.referrer).origin
    } catch {
      return
    }
    if (target !== location.origin && !origins.includes(target)) return
    const main = document.querySelector("main")
    if (!main) return
    let last = 0
    const send = () => {
      const height = Math.max(
        240,
        Math.min(1600, Math.ceil(main.getBoundingClientRect().height))
      )
      if (height === last) return
      last = height
      window.parent.postMessage(
        { type: "libraries-global-widget-resize", publicId, height },
        target
      )
    }
    const observer = new ResizeObserver(send)
    observer.observe(main)
    send()

    return () => observer.disconnect()
  }, [publicId, origins])

  return null
}
