import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { BETA_LEGAL_SLUG } from "@/lib/beta/scope"

import styles from "./beta.module.css"

/** Public project links without the main site's CMS or account providers. */
export async function BetaFooter({ locale }: { readonly locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "beta" })
  const prefix = locale === "en" ? "" : `/${locale}`
  const legal = `${prefix}/legal/${BETA_LEGAL_SLUG}`
  const email = process.env.BETA_CONTACT_EMAIL ?? "info@libraries.global"
  const source =
    process.env.BETA_SOURCE_URL ??
    "https://github.com/webbist-js/libraries.global"

  return (
    <footer className={styles.footer} data-beta-footer="">
      <p>{t("independent")}</p>
      <nav aria-label={t("footerLabel")}>
        <a href={legal}>{t("legal")}</a>
        <a href={`${legal}#privacy`}>{t("privacy")}</a>
        <a href={`mailto:${email}`}>{email}</a>
        <a href={source} target="_blank" rel="noreferrer">
          {t("source")}
        </a>
      </nav>
    </footer>
  )
}
