"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const CARD = "rounded-[20px] border p-5"

/** "The monthly dispatch": the Journal newsletter sign-up. */
export function MonthlyDispatchCard() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === "saving") return
    setStatus("saving")
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "journal" }),
      })
      if (!response.ok) throw new Error("Subscription could not be saved")
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  return (
    <section
      aria-labelledby="journal-dispatch"
      className={CARD}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <h2
        className="type-panel-title m-0"
        id="journal-dispatch"
        style={{ color: T.ink.base }}
      >
        {t("dispatchTitle")}
      </h2>
      <p
        className="mt-1.5 mb-4 text-base leading-[1.5]"
        style={{ color: T.ink.dim }}
      >
        {t("dispatchIntro")}
      </p>

      {status === "done" ? (
        <p
          className="m-0 text-base font-semibold"
          role="status"
          style={{ color: T.accent.ok }}
        >
          {t("dispatchDone")}
        </p>
      ) : (
        <form onSubmit={subscribe}>
          <label
            className="mb-1.5 block text-sm font-medium"
            htmlFor="journal-subscribe"
            style={{ color: T.ink.base }}
          >
            {tUi("email_address")}{" "}
          </label>
          <input
            aria-describedby="journal-subscribe-note"
            autoComplete="email"
            className="min-h-11 w-full rounded-full border px-3.5 py-2.5 text-base"
            id="journal-subscribe"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.org"
            required
            style={{
              background: T.bg.deep,
              borderColor: T.border.hi,
              color: T.ink.base,
            }}
            type="email"
            value={email}
          />
          <button
            className="mt-3 min-h-11 w-fit cursor-pointer rounded-full px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-60"
            disabled={status === "saving"}
            style={{ background: T.accent.primary }}
            type="submit"
          >
            {status === "saving" ? t("subscribing") : tUi("subscribe")}
          </button>
          {status === "error" ? (
            <p
              className="m-0 mt-2 text-base font-semibold"
              role="alert"
              style={{ color: T.accent.danger }}
            >
              {t("subscribeError")}
            </p>
          ) : null}
        </form>
      )}

      <p
        className="m-0 mt-3 text-sm leading-[1.5]"
        id="journal-subscribe-note"
        style={{ color: T.ink.dim }}
      >
        {t.rich("dispatchNote", {
          notifications: (chunks) => (
            <GlobalLink
              className="underline underline-offset-[3px]"
              href="/profile/settings#notifications"
              style={{ color: T.accent.primary }}
            >
              {chunks}
            </GlobalLink>
          ),
          privacy: (chunks) => (
            <GlobalLink
              className="underline underline-offset-[3px]"
              href="/legal/privacy"
              style={{ color: T.accent.primary }}
            >
              {chunks}
            </GlobalLink>
          ),
        })}
      </p>
    </section>
  )
}
