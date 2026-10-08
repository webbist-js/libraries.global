"use client"
import { useEffect, useState } from "react"

/** The first server render stays independent of the time and viewer. */
export function useMobileClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setNow(new Date())
    }
    const first = setTimeout(update, 0),
      timer = setInterval(update, 30000)
    document.addEventListener("visibilitychange", update)

    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener("visibilitychange", update)
    }
  }, [])

  return now
}
