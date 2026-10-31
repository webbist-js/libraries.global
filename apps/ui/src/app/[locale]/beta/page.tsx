import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import {
  getTranslations as getUiTranslations,
  setRequestLocale,
} from "next-intl/server"

import { AppearanceControl } from "@/components/appearance/AppearanceControl"
import styles from "@/components/beta/beta.module.css"
import { BetaFooter } from "@/components/beta/BetaFooter"
import { BetaForms } from "@/components/beta/BetaForms"
import { MainContent } from "@/components/ds/MainContent"
import {
  BETA_COOKIE,
  betaConfigured,
  betaDestination,
  betaEnabled,
} from "@/lib/beta/access"
import { hasBetaAccess } from "@/lib/beta/invitations"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Closed beta",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default async function BetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ next?: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === "en" ? "" : `/${locale}`
  const fallback = prefix || "/"
  const next = betaDestination((await searchParams).next, fallback)
  if (
    !betaEnabled() ||
    (await hasBetaAccess((await cookies()).get(BETA_COOKIE)?.value))
  )
    redirect(next)
  const t = await getUiTranslations("beta")

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a
          className={styles.wordmark}
          href={`${prefix}/beta`}
          aria-label="Libraries Global"
        >
          {tUi("libraries")} <em>Global</em>
        </a>
        <div className="flex items-center gap-3">
          <span className={styles.badge}>{t("badge")}</span>
          <AppearanceControl />
        </div>
      </header>
      <MainContent className={styles.main}>
        <section className={styles.introduction}>
          <h1 className="type-h1">
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
      </MainContent>
      <BetaFooter locale={locale} />
    </div>
  )
}
