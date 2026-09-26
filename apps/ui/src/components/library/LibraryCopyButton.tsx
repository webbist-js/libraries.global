"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"

export function LibraryCopyButton({ text }: { readonly text: string }) {
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
      className="border-0 bg-transparent p-0 text-[16px] font-semibold underline underline-offset-[3px]"
      style={{ color: T.accent.primary, cursor: "pointer" }}
    >
      {copied ? "Copied ✓" : "Copy address"}
    </button>
  )
}
