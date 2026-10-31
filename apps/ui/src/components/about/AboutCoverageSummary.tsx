import { useFormatter, useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageStats } from "@/components/home/homepage.types"

/** About's coverage context and live figures share one visual hierarchy. */
export function AboutCoverageSummary({
  stats,
}: {
  readonly stats: HomepageStats | null
}) {
  const t = useTranslations("aboutCoverage")
  const format = useFormatter()
  const activity = stats
    ? [
        {
          value: stats.contributors,
          label: t("contributors", { count: stats.contributors }),
        },
        {
          value: stats.contributionsThisMonth,
          label: t("changes", { count: stats.contributionsThisMonth }),
        },
      ].filter((item) => item.value > 0)
    : []

  return (
    <div className="about-coverage-summary">
      <div className="about-coverage-intro">
        <p className="about-eyebrow">{t("eyebrow")}</p>
        <h2 id="about-coverage-title" className="type-h2">
          {t("title")}
        </h2>
        <p className="about-coverage-copy">{t("description")}</p>
        <GlobalLink
          href="/knowledge/data-api/how-we-count"
          className="about-text-link"
        >
          {t("method")}
        </GlobalLink>
      </div>
      {stats ? (
        <div className="about-coverage-figures">
          <dl className="about-coverage-totals" aria-label={t("eyebrow")}>
            <div>
              <dt>{t("libraries", { count: stats.libraries })}</dt>
              <dd className="type-stat">{format.number(stats.libraries)}</dd>
            </div>
            <div>
              <dt>{t("countries", { count: stats.countries })}</dt>
              <dd className="type-stat">{format.number(stats.countries)}</dd>
            </div>
          </dl>
          {activity.length ? (
            <dl className="about-coverage-activity" aria-label={t("activity")}>
              {activity.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd className="type-h3">{format.number(item.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : (
        <div className="about-coverage-unavailable">
          <p role="status">{t("unavailable")}</p>
          <GlobalLink href="/libraries" className="about-text-link">
            {t("browse")}
          </GlobalLink>
        </div>
      )}
    </div>
  )
}
