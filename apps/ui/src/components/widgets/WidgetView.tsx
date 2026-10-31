"use client"
import { useId } from "react"

import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { WidgetChart } from "@/components/widgets/WidgetChart"
import { WidgetCredits } from "@/components/widgets/WidgetCredits"
import { WidgetFinder } from "@/components/widgets/WidgetFinder"
import { WidgetStat } from "@/components/widgets/WidgetStat"

export function WidgetView({
  data,
  siteUrl = "",
  preview = false,
}: {
  readonly data: WidgetPresentationData
  readonly siteUrl?: string
  readonly preview?: boolean
}) {
  const { config: c, type } = data
  const id = useId()
  const Heading = preview ? "h2" : "h1"

  return (
    <article
      lang={c.locale}
      className="@container min-w-0 bg-(--t-bg-deep) wrap-break-word text-(--t-ink-base)"
      aria-labelledby={`${id}-title`}
      style={{
        border:
          c.border === "none"
            ? 0
            : c.border === "strong"
              ? "2px solid var(--t-ink-base)"
              : "1px solid var(--t-border-line)",
        borderRadius: c.radius === "square" ? 0 : c.radius === "soft" ? 12 : 24,
        padding: c.density === "compact" ? 16 : 24,
      }}
    >
      <header className="mb-5 space-y-2">
        <Heading
          id={`${id}-title`}
          className="type-panel-title m-0 wrap-break-word"
        >
          {c.title}
        </Heading>
        {c.introduction ? (
          <p className="m-0 text-base text-(--t-ink-dim)">{c.introduction}</p>
        ) : null}
        <p className="sr-only">{c.description}</p>
      </header>

      {type === "finder" || type === "directory" ? (
        <WidgetFinder data={data} siteUrl={siteUrl} />
      ) : null}
      {type === "chart" ? <WidgetChart data={data} /> : null}
      {type === "stat" ? <WidgetStat data={data} /> : null}
      <WidgetCredits data={data} siteUrl={siteUrl} />
    </article>
  )
}
