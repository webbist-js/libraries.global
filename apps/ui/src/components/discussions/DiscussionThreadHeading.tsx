"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { BackLink } from "@/components/ds/BackLink"

/** Reader-owned title: separate from the directory hero, with workflow slots kept by the thread. */
export function DiscussionThreadHeading({
  title,
  language,
  context,
  activity,
  action,
}: {
  readonly title: string
  readonly language?: string
  readonly context?: ReactNode
  readonly activity?: ReactNode
  readonly action?: ReactNode
}) {
  const t = useTranslations("discussions")

  return (
    <header className="grid gap-4 border-b border-(--t-border-line) pb-6">
      <BackLink href="/community/discussions">{t("back")}</BackLink>
      {context}
      <h1
        className="type-h1 m-0 max-w-[25ch] text-balance wrap-anywhere"
        lang={language}
      >
        {title}
      </h1>
      {activity || action ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {activity}
          {action}
        </div>
      ) : null}
    </header>
  )
}
