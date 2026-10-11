"use client"

import { MessageSquare } from "lucide-react"

import { useContactModal } from "@/components/contact/ContactModalProvider"

export function BetaFeedback({ label }: { readonly label: string }) {
  const { openFeedback } = useContactModal()

  return (
    <button
      type="button"
      onClick={openFeedback}
      aria-haspopup="dialog"
      className="fixed top-1/2 left-0 z-40 inline-flex min-h-11 w-11 -translate-y-1/2 flex-col items-center gap-2 rounded-r-[20px] border border-l-0 border-(--t-border-line) bg-white py-3 text-sm font-semibold text-(--t-ink-base) shadow-sm transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
    >
      <MessageSquare aria-hidden="true" size={16} />
      <span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">
        {label}
      </span>
    </button>
  )
}
