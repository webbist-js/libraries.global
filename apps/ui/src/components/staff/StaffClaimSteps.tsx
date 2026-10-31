"use client"

import { useTranslations } from "next-intl"

/** One claim process, shown inline during onboarding or vertically beside the form. */
export function StaffClaimSteps({
  layout = "horizontal",
}: {
  readonly layout?: "horizontal" | "vertical"
}) {
  const t = useTranslations("libraryClaim")
  const vertical = layout === "vertical"

  return (
    <ol
      className={`m-0 grid list-none p-0 ${vertical ? "gap-6" : "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3"}`}
    >
      {(["find", "details", "review"] as const).map((step, index) => (
        <li
          key={step}
          className={
            vertical
              ? "flex items-start gap-3"
              : "rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4"
          }
        >
          <span
            aria-hidden="true"
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-(--t-action-primary)/10 text-sm font-semibold text-(--t-accent-primary) ${vertical ? "" : "mb-3"}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="type-small-heading m-0 text-(--t-ink-base)">
              {t(step)}
            </h3>
            <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t(`${step}Body`)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
