"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { pushCheckoutEvent } from "@/lib/checkout-analytics"
import { Link, useRouter } from "@/lib/navigation"
import {
  rememberTeamApiChoice,
  subscribeTeamApiChoice,
  teamApiChoiceSelected,
} from "@/lib/team-purchase-intent"

export function TeamPurchaseProgress({
  stage,
}: {
  readonly stage: "team" | "api" | "complete"
}) {
  const t = useTranslations("teamPurchase")

  return (
    <ol
      aria-label={t("stepsLabel")}
      className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2"
    >
      {(["team", "api"] as const).map((item, index) => {
        const done =
          stage === "complete" || (item === "team" && stage === "api")
        const current = stage === item

        return (
          <li
            key={item}
            aria-current={current ? "step" : undefined}
            className={`flex items-center gap-3 rounded-2xl border p-4 ${current ? "border-(--t-accent-primary) bg-(--t-accent-chip)/30" : "border-(--t-border-line)"}`}
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-(--t-accent-chip) text-sm font-semibold text-(--t-accent-primary)"
            >
              {done ? "✓" : index + 1}
            </span>
            <span>
              <strong className="block text-sm">
                {t(item === "team" ? "teamStep" : "apiStep")}
              </strong>
              <span className="mt-1 block text-xs text-(--t-ink-dim)">
                {t(done ? "confirmed" : item === "team" ? "yearly" : "monthly")}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Resume the optional second purchase only after the authoritative Team is ready. */
export function TeamApiNextStep({
  teamId,
  ready,
  organiser,
  initialSelected = false,
}: {
  readonly initialSelected?: boolean
  readonly teamId: string
  readonly ready: boolean
  readonly organiser: boolean
}) {
  const t = useTranslations("teamPurchase")
  const [skipped, setSkipped] = useState(false)
  const stored = useSyncExternalStore(
    subscribeTeamApiChoice,
    () => teamApiChoiceSelected(teamId),
    () => false
  )
  const selected = !skipped && (initialSelected || stored)
  const router = useRouter()
  useEffect(() => {
    if (initialSelected) rememberTeamApiChoice(teamId, true)
  }, [teamId, initialSelected])
  if (!selected || !organiser) return null

  return (
    <section
      aria-label={t("journeyTitle")}
      className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
    >
      <h2 className="type-h3 m-0 mb-4">{t("journeyTitle")}</h2>
      <TeamPurchaseProgress stage={ready ? "api" : "team"} />
      <p
        role="status"
        className="my-5 text-sm leading-relaxed text-(--t-ink-dim)"
      >
        {t(ready ? "teamReady" : "waitingForTeam")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {ready ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--t-action-primary) px-5 text-sm font-semibold text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]"
            onClick={() =>
              pushCheckoutEvent("checkout_step", {
                product: "team_api",
                billing_interval: "month",
                checkout_step: "api_review",
              })
            }
            href="/developers?setup=1"
          >
            {t("continueApi")}
          </Link>
        ) : (
          <Button variant="primary" size="pill" disabled>
            {t("waiting")}
          </Button>
        )}
        <Button
          variant="surface"
          size="pill"
          onClick={() => {
            rememberTeamApiChoice(teamId, false)
            setSkipped(true)
            router.replace("/staff/teams/billing")
          }}
        >
          {t("skipApi")}
        </Button>
      </div>
    </section>
  )
}
