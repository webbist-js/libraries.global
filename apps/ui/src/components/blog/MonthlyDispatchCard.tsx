"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

/** "The monthly dispatch": the Journal newsletter sign-up. */
export function MonthlyDispatchCard() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")
  // Desktop navigation and the mobile section drawer can be mounted together.
  const id = useId()
  const headingId = `${id}-dispatch`
  const emailId = `${id}-email`
  const noteId = `${id}-note`

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
    <section aria-labelledby={headingId} className="min-w-0">
      <h2
        className="type-panel-title m-0"
        id={headingId}
        style={{ color: T.ink.base }}
      >
        {t("dispatchTitle")}
      </h2>
      <p
        className="mt-1.5 mb-3 text-sm leading-[1.5]"
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
            className="sr-only"
            htmlFor={emailId}
            style={{ color: T.ink.base }}
          >
            {tUi("email_address")}{" "}
          </label>
          <div className="flex items-stretch gap-2">
            <input
              aria-describedby={noteId}
              autoComplete="email"
              className="h-11 min-h-11 min-w-0 flex-1 rounded-full border px-3 py-2 text-sm"
              id={emailId}
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
              className="h-11 min-h-11 shrink-0 cursor-pointer rounded-full bg-(--t-action-primary) px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--t-action-primary-hover) disabled:opacity-60 motion-reduce:transition-none"
              disabled={status === "saving"}
              type="submit"
            >
              {status === "saving" ? t("subscribing") : tUi("subscribe")}
            </button>
          </div>
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
        className="m-0 mt-2 text-sm leading-[1.5]"
        id={noteId}
        style={{ color: T.ink.dim }}
      >
        {t.rich("dispatchNote", {
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
