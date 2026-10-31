"use client"

import { ShieldAlert, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/styles"

/** Presentation only: callers and the API still enforce moderation permission. */
export function DiscussionModeratorButton({
  children,
  className,
  tone = "danger",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "danger" | "neutral"
}) {
  const t = useTranslations("discussions")
  const Icon = tone === "danger" ? ShieldAlert : ShieldCheck

  return (
    <button
      type="button"
      title={t("moderatorAction")}
      aria-description={t("moderatorAction")}
      {...props}
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
        tone === "danger"
          ? "border-(--t-action-danger) bg-(--t-action-danger) text-white hover:bg-(--t-action-danger)/90"
          : "border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface)",
        className
      )}
    >
      <Icon size={15} aria-hidden />
      {children}
    </button>
  )
}
