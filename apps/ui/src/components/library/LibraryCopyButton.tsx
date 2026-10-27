"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

/** A small white pill that copies `text` and says so for a moment. */
export function LibraryCopyButton({
  text,
  label = "Copy address",
}: {
  readonly text: string
  readonly label?: string
}) {
  const tUi = useUiTranslations("ui")

  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // clipboard unavailable — ignore
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface)"
      style={{ borderColor: T.border.hi, color: T.ink.base }}
    >
      <Icon
        aria-hidden="true"
        height={15}
        icon={copied ? "mdi:check" : "mdi:content-copy"}
        width={15}
      />
      <span aria-live="polite">{copied ? tUi("copied") : label}</span>
    </button>
  )
}
