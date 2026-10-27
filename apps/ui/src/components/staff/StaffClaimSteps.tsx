"use client"

import { useTranslations } from "next-intl"

/** Compact version of the claim steps, for Team members without assignments. */
export function StaffClaimSteps() {
  const t = useTranslations("staffWorkspace")

  return (
    <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
      {(["Find", "Proof", "Review"] as const).map((step, index) => (
        <li
          key={step}
          className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4"
        >
          <span
            aria-hidden="true"
            className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-(--t-accent-primary)/10 text-sm font-semibold text-(--t-accent-primary)"
          >
            {index + 1}
          </span>
          <h3 className="type-small-heading m-0 text-(--t-ink-base)">
            {t(`claimStep${step}`)}
          </h3>
          <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {t(`claimStep${step}Detail`)}
          </p>
        </li>
      ))}
    </ol>
  )
}
