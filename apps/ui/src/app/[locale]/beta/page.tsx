import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import styles from "@/components/beta/beta.module.css"
import { BetaForms } from "@/components/beta/BetaForms"
import {
  BETA_COOKIE,
  betaConfigured,
  betaDestination,
  betaEnabled,
  validBetaPass,
} from "@/lib/beta/access"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Closed beta",
  robots: { index: false, follow: false },
}

export default async function BetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const fallback = locale === "cs" ? "/cs" : "/"
  const next = betaDestination((await searchParams).next, fallback)
  if (
    !betaEnabled() ||
    validBetaPass((await cookies()).get(BETA_COOKIE)?.value)
  )
    redirect(next)
  const t = await getTranslations("beta")
  const email = process.env.BETA_CONTACT_EMAIL ?? "hello@libraries.global"
  const source =
    process.env.BETA_SOURCE_URL ??
    "https://github.com/webbist-js/libraries.global"
  const privacy = locale === "cs" ? "/cs/legal/privacy" : "/legal/privacy"

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a
          className={styles.wordmark}
          href={locale === "cs" ? "/cs/beta" : "/beta"}
          aria-label="Libraries Global"
        >
          Libraries <em>Global</em>
        </a>
        <span className={styles.badge}>{t("badge")}</span>
      </header>
      <div className={styles.main}>
        <section className={styles.introduction}>
          <h1>
            {t("headlineFirst")}
            <br />
            {t("headlineSecond")}
            <br />
            <em>{t("headlineLast")}</em>
          </h1>
          <p className={styles.lead}>{t("introduction")}</p>
          <ul className={styles.notes}>
            <li>{t("notePlaces")}</li>
            <li>{t("noteReset")}</li>
            <li>{t("notePassword")}</li>
          </ul>
        </section>
        <BetaForms next={next} locale={locale} available={betaConfigured()} />
      </div>
      <footer className={styles.footer}>
        <p>{t("independent")}</p>
        <nav aria-label={t("footerLabel")}>
          <a href={privacy}>{t("privacy")}</a>
          <a href={`mailto:${email}`}>{email}</a>
          <a href={source} target="_blank" rel="noreferrer">
            {t("source")}
          </a>
        </nav>
      </footer>
    </div>
  )
}
