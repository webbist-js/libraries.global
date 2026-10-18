"use client"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { SuggestionReviewRound } from "@/lib/community/suggestions"

export function SuggestionRoundControls({
  initial,
}: {
  initial?: SuggestionReviewRound | null
}) {
  const t = useTranslations("optionSuggestions")
  const [round, setRound] = useState(initial ?? null)
  const [cutoff, setCutoff] = useState(initial?.cutoffAt.slice(0, 16) ?? "")
  const [review, setReview] = useState(initial?.reviewAt.slice(0, 16) ?? "")
  const [capacity, setCapacity] = useState(initial?.capacity ?? 5)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  function adopt(value: SuggestionReviewRound) {
    setRound(value)
    setCutoff(value.cutoffAt.slice(0, 16))
    setReview(value.reviewAt.slice(0, 16))
    setCapacity(value.capacity)
  }
  useEffect(() => {
    if (initial) return
    const controller = new AbortController()
    fetch("/api/moderation/suggestion-round", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data && !controller.signal.aborted) adopt(json.data)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [initial])
  async function save(action: "schedule" | "close") {
    if (!round || busy) return
    setBusy(true)
    setFailed(false)
    setMessage("")
    try {
      const res = await fetch("/api/moderation/suggestion-round", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          version: round.version,
          ...(action === "schedule"
            ? {
                cutoffAt: new Date(`${cutoff}Z`).toISOString(),
                reviewAt: new Date(`${review}Z`).toISOString(),
                capacity,
              }
            : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFailed(true)
        setMessage(json.error?.message ?? t("roundFailed"))
      } else {
        adopt(json.data)
        setMessage(t("roundSaved"))
      }
    } catch {
      setFailed(true)
      setMessage(t("roundFailed"))
    } finally {
      setBusy(false)
    }
  }
  if (!round) return <p role="status">{t("reviewUnavailable")}</p>

  return (
    <section className="grid gap-4 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5">
      <h2 className="m-0 font-serif text-2xl">{t("manageRound")}</h2>
      {round.state === "voting" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            {t("cutoffAt")}
            <input
              type="datetime-local"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="min-h-11 rounded-lg border p-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("reviewAt")}
            <input
              type="datetime-local"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-11 rounded-lg border p-2"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("capacity")}
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="min-h-11 rounded-lg border p-2"
            />
          </label>
        </div>
      ) : (
        <ol className="m-0 grid gap-2 pl-5 text-sm">
          {round.shortlist.map((item) => (
            <li key={item.documentId}>
              <a
                href={`#moderation-suggestion-${item.documentId}`}
                className="underline"
              >
                {item.name}
              </a>{" "}
              · {t("votes", { count: item.votes })}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void save(round.state === "voting" ? "schedule" : "close")
        }
        className="min-h-11 justify-self-start rounded-full bg-(--t-accent-primary) px-5 font-semibold text-white disabled:opacity-50"
      >
        {t(round.state === "voting" ? "saveRound" : "completeRound")}
      </button>
      {message && (
        <p role={failed ? "alert" : "status"} className="m-0 text-sm">
          {message}
        </p>
      )}
    </section>
  )
}
