"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"

const COPIED = "Link copied"
const FAILED = "Couldn’t copy the link. Copy it from the address bar."

/**
 * "Share this drive": copies the page's address, and says so in a polite
 * live region ("Link copied") that clears after a few seconds.
 */
export function DriveShareButton({ title }: { readonly title: string }) {
  const [message, setMessage] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setMessage(COPIED)
    } catch {
      setMessage(FAILED)
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(""), 4000)
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={share}
        title={`Copy a link to “${title}”`}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-[18px] text-[15px] font-semibold transition-colors hover:border-(--t-accent-primary)"
        style={{ color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon={message === COPIED ? "mdi:check" : "mdi:link-variant"}
          width={17}
        />
        Share this drive
      </button>
      <span
        role="status"
        aria-live="polite"
        className="text-[14px] font-semibold"
        style={{ color: message === FAILED ? T.accent.danger : T.accent.ok }}
      >
        {message}
      </span>
    </span>
  )
}
