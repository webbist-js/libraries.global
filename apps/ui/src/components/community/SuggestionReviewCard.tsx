"use client"

import { useLocale, useNow, useTranslations } from "next-intl"

import { StepsCard } from "@/components/ds/StepsCard"
import type { SuggestionReviewRound } from "@/lib/community/suggestions"

export function SuggestionReviewCard({
  round,
}: {
  round: SuggestionReviewRound | null
}) {
  const t = useTranslations("optionSuggestions")
  const locale = useLocale()
  const now = useNow({ updateInterval: 60000 }).getTime()
  if (!round)
    return (
      <p className="text-sm text-(--t-ink-dim)">{t("reviewUnavailable")}</p>
    )
  const cutoff = Date.parse(round.cutoffAt)
  const opens = Date.parse(round.opensAt)
  const days = Math.max(0, Math.ceil((cutoff - now) / 86400000))
  const rawProgress = Math.max(
    0,
    Math.min(100, ((now - opens) / Math.max(1, cutoff - opens)) * 100)
  )
  // CSSOM rounds long decimals when parsing SSR styles. Keep both renders identical.
  const progress = Math.round(rawProgress * 100) / 100
  const review = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(round.reviewAt))

  return (
    <section className="rounded-[32px] bg-(--t-ink-base) p-6 text-white sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="m-0 font-sans text-sm leading-snug font-bold tracking-[0.1em] text-[#c5c0e9] uppercase">
          {t("nextReview")}
        </h2>
        <time
          className="text-sm text-(--t-ink-on-dark)"
          dateTime={round.reviewAt}
        >
          {review}
        </time>
      </div>
      {round.state === "voting" && days > 0 ? (
        <>
          <p className="mt-2 mb-5 flex flex-wrap items-baseline gap-3">
            <span className="font-serif text-[72px] leading-none tracking-tight text-white">
              {days}
            </span>
            <span className="text-base text-(--t-ink-on-dark)">
              {t("daysToVote", { count: days })}
            </span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("votingProgress")}
            className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-[#8d82f5]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <p className="my-4 font-serif text-2xl">
          {t(round.state === "voting" ? "cutoffReached" : "reviewInProgress")}
        </p>
      )}
      <p className="sr-only">
        {t("cutoffTime", {
          date: new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(new Date(round.cutoffAt)),
        })}
      </p>
      <p className="mt-4 mb-0 text-[15px] leading-[1.55] text-(--t-ink-on-dark)">
        {t(round.state === "voting" ? "reviewVoteHint" : "shortlistSaved", {
          count: round.capacity,
        })}
      </p>
    </section>
  )
}

export function SuggestionHowItWorks() {
  const t = useTranslations("optionSuggestions")

  return (
    <StepsCard
      title={t("howTitle")}
      steps={(["howSubmit", "howVote", "howReview", "howPublish"] as const).map(
        (key) => ({ id: key, content: t(key) })
      )}
    />
  )
}
