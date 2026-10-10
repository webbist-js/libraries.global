"use client"

import { Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import styles from "./beta.module.css"

type FormStatus = "idle" | "saving" | "error" | "done"

export function BetaForms({
  next,
  locale,
  available,
}: {
  readonly next: string
  readonly locale: string
  readonly available: boolean
}) {
  const t = useTranslations("beta")
  const [visible, setVisible] = useState(false)
  const [password, setPassword] = useState("")
  const [accessStatus, setAccessStatus] = useState<FormStatus>("idle")
  const [accessError, setAccessError] = useState("")
  const [destination, setDestination] = useState(next)
  const [email, setEmail] = useState("")
  const [acceptedEmail, setAcceptedEmail] = useState("")
  const [waitlistStatus, setWaitlistStatus] = useState<FormStatus>("idle")
  const [waitlistError, setWaitlistError] = useState("")

  useEffect(() => {
    if (accessStatus !== "done") return
    const timer = window.setTimeout(
      () => window.location.assign(destination),
      1500
    )

    return () => window.clearTimeout(timer)
  }, [accessStatus, destination])

  async function enter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (accessStatus === "saving") return
    setAccessStatus("saving")
    setAccessError("")
    try {
      const res = await fetch("/api/beta/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      })
      if (!res.ok) {
        setAccessError(
          t(
            res.status === 401
              ? "wrongPassword"
              : res.status === 429
                ? "rateLimited"
                : "unavailable"
          )
        )
        setAccessStatus("error")

        return
      }
      const body = (await res.json()) as { next: string }
      setPassword("")
      setDestination(body.next)
      setAccessStatus("done")
    } catch {
      setAccessError(t("unavailable"))
      setAccessStatus("error")
    }
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (waitlistStatus === "saving") return
    const data = new FormData(event.currentTarget)
    const submittedEmail = email.trim()
    setWaitlistStatus("saving")
    setWaitlistError("")
    try {
      const res = await fetch("/api/beta/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: submittedEmail,
          website: data.get("website") ?? "",
          locale,
        }),
      })
      if (!res.ok) {
        setWaitlistError(
          t(
            res.status === 400
              ? "invalidEmail"
              : res.status === 429
                ? "rateLimited"
                : "waitlistUnavailable"
          )
        )
        setWaitlistStatus("error")

        return
      }
      setAcceptedEmail(submittedEmail)
      setWaitlistStatus("done")
    } catch {
      setWaitlistError(t("waitlistUnavailable"))
      setWaitlistStatus("error")
    }
  }

  if (accessStatus === "done")
    return (
      <section
        className={`${styles.card} ${styles.accepted}`}
        aria-live="polite"
      >
        <span className={styles.successIcon}>
          <Check aria-hidden="true" size={28} />
        </span>
        <h2>{t("acceptedTitle")}</h2>
        <p>{t("acceptedDescription")}</p>
        <a className={styles.continue} href={destination}>
          {t("continue")}
        </a>
      </section>
    )

  return (
    <div className={styles.forms}>
      <section className={styles.card} aria-labelledby="beta-entry-title">
        <h2 id="beta-entry-title">{t("entryTitle")}</h2>
        <p>{t("entryDescription")}</p>
        <form onSubmit={enter}>
          <label htmlFor="beta-password">{t("passwordLabel")}</label>
          <div
            className={`${styles.passwordField} ${accessStatus === "error" ? styles.invalid : ""}`}
          >
            <input
              id="beta-password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              maxLength={512}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={accessStatus === "error"}
              aria-describedby={
                accessError || !available ? "beta-password-error" : undefined
              }
              disabled={accessStatus === "saving" || !available}
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              aria-controls="beta-password"
              aria-pressed={visible}
            >
              {t(visible ? "hide" : "show")}
            </button>
          </div>
          {accessError || !available ? (
            <p id="beta-password-error" className={styles.error} role="alert">
              {accessError || t("unavailable")}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.primary}
            disabled={accessStatus === "saving" || !available}
          >
            {t(accessStatus === "saving" ? "entering" : "enter")}
          </button>
        </form>
      </section>
      <section
        className={styles.waitlist}
        aria-labelledby="beta-waitlist-title"
      >
        <h2 id="beta-waitlist-title">{t("waitlistTitle")}</h2>
        <p>{t("waitlistDescription")}</p>
        {waitlistStatus === "done" ? (
          <div className={styles.waitlistSuccess} role="status">
            <Check aria-hidden="true" size={26} />
            <p>
              {t.rich("waitlistSuccess", {
                email: acceptedEmail,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={join} className={styles.waitlistForm}>
              <label className="sr-only" htmlFor="beta-email">
                {t("emailLabel")}
              </label>
              <input
                id="beta-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                placeholder="you@example.org"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={waitlistStatus === "error"}
                aria-describedby="beta-waitlist-note beta-waitlist-error"
                disabled={waitlistStatus === "saving"}
              />
              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="beta-website">Website</label>
                <input
                  id="beta-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className={styles.secondary}
                disabled={waitlistStatus === "saving"}
              >
                {t(
                  waitlistStatus === "saving" ? "requesting" : "requestAccess"
                )}
              </button>
            </form>
            <p
              id="beta-waitlist-error"
              className={styles.error}
              role="status"
              aria-live="polite"
            >
              {waitlistError}
            </p>
            <p id="beta-waitlist-note" className={styles.note}>
              {t("waitlistNote")}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
