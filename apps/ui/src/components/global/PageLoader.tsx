"use client"

import { useEffect, useId, useRef, useState } from "react"

import { LIBRARIES_GLOBAL_MARK } from "@/components/global/LibrariesGlobalMark"

import styles from "./PageLoader.module.css"

/** A real pending state: no timers, artificial progress or minimum display time. */
export function PageLoader({ label }: { readonly label: string }) {
  const maskId = useId()
  const root = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let visible = true
    const update = () => setPaused(!visible || document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      update()
    })
    if (root.current) observer.observe(root.current)
    document.addEventListener("visibilitychange", update)
    update()

    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [])

  return (
    <div ref={root} className={styles.root} data-paused={paused}>
      <svg
        aria-hidden="true"
        viewBox="0 0 640 640"
        fill="currentColor"
        className={styles.mark}
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="640"
            height="640"
          >
            <rect width="640" height="640" fill="white" />
            <path
              d={LIBRARIES_GLOBAL_MARK.window}
              fill="black"
              className={styles.window}
            />
          </mask>
        </defs>
        <g className={styles.assembly}>
          <path d={LIBRARIES_GLOBAL_MARK.back} className={styles.back} />
          <path d={LIBRARIES_GLOBAL_MARK.middle} className={styles.middle} />
          <g className={styles.front}>
            <path d={LIBRARIES_GLOBAL_MARK.front} mask={`url(#${maskId})`} />
          </g>
        </g>
      </svg>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {label}
      </span>
    </div>
  )
}
