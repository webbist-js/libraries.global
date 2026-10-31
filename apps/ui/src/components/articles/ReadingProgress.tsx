"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

/** Observe the actual article in its dashboard scroller, including resize/reflow. */
export function ReadingProgress({
  bodyId,
  minutes,
}: {
  readonly bodyId: string
  readonly minutes: number
}) {
  const t = useTranslations("dashboard")
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const body = document.getElementById(bodyId)
    const scroller = body?.closest<HTMLElement>(
      '[data-dashboard-scroll="content"]'
    )
    if (!body || !scroller) return
    const root = scroller.closest<HTMLElement>("[data-dashboard-page]")
    let frame = 0
    const measure = () => {
      frame = 0
      const rect = body.getBoundingClientRect(),
        viewport = (
          window.matchMedia("(min-width: 1024px)").matches
            ? scroller
            : (root ?? scroller)
        ).getBoundingClientRect()
      const available = Math.max(1, rect.height - viewport.height * 0.5)
      setProgress(
        Math.max(
          0,
          Math.min(
            1,
            (viewport.top + viewport.height * 0.2 - rect.top) / available
          )
        )
      )
    }
    const update = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(update)
    observer.observe(body)
    observer.observe(scroller)
    if (root) observer.observe(root)
    root?.addEventListener("scroll", update, { passive: true })
    scroller.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    update()

    return () => {
      observer.disconnect()
      scroller.removeEventListener("scroll", update)
      root?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      cancelAnimationFrame(frame)
    }
  }, [bodyId])

  return (
    <div className="reading-progress">
      <label htmlFor={`${bodyId}-progress`}>{t("readingProgress")}</label>
      <progress id={`${bodyId}-progress`} max={1} value={progress} />
      <span>
        {t("minutesRemaining", {
          count: Math.max(0, Math.ceil(minutes * (1 - progress))),
        })}
      </span>
    </div>
  )
}
