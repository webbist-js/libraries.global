"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

interface CalendarSubscribeButtonProps {
  icsUrl: string
  label?: string
}

export function CalendarSubscribeButton({
  icsUrl,
  label = "Subscribe",
}: CalendarSubscribeButtonProps) {
  const [open, setOpen] = useState(false)

  // webcal:// links trigger native calendar apps; https:// links for manual import
  const webcalUrl = icsUrl.replace(/^https?:\/\//, "webcal://")

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-colors duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
        style={{
          fontFamily: T.font.mono,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          borderColor: T.border.line,
          color: T.ink.dim,
        }}
      >
        <Icon icon="mdi:calendar-sync-outline" className="size-4" />
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 z-20 mt-1.5 w-52 rounded-xl border p-2"
          style={{ background: T.bg.deep, borderColor: T.border.hi }}
        >
          <a
            href={webcalUrl}
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: T.ink.dim, textDecoration: "none" }}
          >
            <Icon
              icon="mdi:calendar-check"
              className="size-4"
              style={{ color: T.accent.aurora }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".1em",
              }}
            >
              Subscribe (calendar app)
            </span>
          </a>
          <a
            href={icsUrl}
            download
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: T.ink.dim, textDecoration: "none" }}
          >
            <Icon
              icon="mdi:download-outline"
              className="size-4"
              style={{ color: T.ink.faint }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".1em",
              }}
            >
              Download .ics file
            </span>
          </a>
        </div>
      )}
    </div>
  )
}
