"use client"

import { useTranslations } from "next-intl"

/** Fits over an existing map container without intercepting its controls. */
export function MapLoading() {
  const t = useTranslations("ui")

  return (
    <div
      role="status"
      aria-busy="true"
      className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center p-6"
    >
      <span className="inline-flex items-center gap-2.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-3 text-sm font-semibold text-(--t-ink-base) shadow-sm">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border-2 border-(--t-accent-chip) border-t-(--t-accent-primary) motion-safe:animate-spin"
        />
        {t("loading_map")}
      </span>
    </div>
  )
}
