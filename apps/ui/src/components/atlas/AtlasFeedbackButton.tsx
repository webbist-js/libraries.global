"use client"

import { MessageSquare } from "lucide-react"
import { useTranslations } from "next-intl"

import { useContactModal } from "@/components/contact/ContactModalProvider"

export function AtlasFeedbackButton() {
  const t = useTranslations("ui")
  const { openAtlasFeedback } = useContactModal()

  return (
    <button
      type="button"
      onClick={openAtlasFeedback}
      aria-haspopup="dialog"
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-(--t-ink-dim) transition-colors hover:bg-(--t-bg-selected) hover:text-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
    >
      <MessageSquare size={16} aria-hidden="true" />
      {t("feedback")}
    </button>
  )
}
