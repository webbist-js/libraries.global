"use client"

import { MessageSquare } from "lucide-react"
import { usePathname } from "next/navigation"

export function BetaFeedback({
  email,
  label,
}: {
  readonly email: string
  readonly label: string
}) {
  const pathname = usePathname()
  const href = `mailto:${email}?subject=${encodeURIComponent("Libraries Global beta feedback")}&body=${encodeURIComponent(`Page: ${pathname}\n\n`)}`

  return (
    <a
      href={href}
      className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full border border-(--t-border-line) bg-white px-4 py-2.5 text-sm font-semibold text-(--t-ink-base) shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
    >
      <MessageSquare aria-hidden="true" size={16} />
      {label}
    </a>
  )
}
