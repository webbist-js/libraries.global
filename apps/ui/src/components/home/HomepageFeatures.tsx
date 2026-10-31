import {
  Accessibility,
  BookOpen,
  Download,
  Globe,
  HeartHandshake,
  Library,
  Map,
  Target,
} from "lucide-react"
import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import { PRO_FEATURE_COPY } from "@/lib/plans"

// Access and delivery status belong to the product, rather than editorial CMS copy.
const GROUPS = [
  {
    key: "explore",
    features: [
      { key: "map", Icon: Map, access: "free", href: "/map" },
      { key: "layers", Icon: Accessibility, access: "account", href: "/map" },
      {
        key: "community",
        Icon: HeartHandshake,
        access: "account",
        href: "/community",
      },
      { key: "reading", Icon: BookOpen, access: "free", href: "/knowledge" },
    ],
  },
  {
    key: "work",
    features: [
      {
        key: "access",
        Icon: Globe,
        access: "pro",
        href: "/map",
        live: PRO_FEATURE_COPY["atlas.compare"].status === "live",
      },
      {
        key: "reach",
        Icon: Target,
        access: "pro",
        href: "/map",
        live: PRO_FEATURE_COPY["atlas.analysis"].status === "live",
      },
      {
        key: "export",
        Icon: Download,
        access: "pro",
        href: "/map",
        live: PRO_FEATURE_COPY["atlas.export"].status === "live",
      },
      { key: "staff", Icon: Library, access: "staff", href: "/staff/claim" },
    ],
  },
] as const

export function HomepageFeatures() {
  const t = useTranslations("homepageFeatures")

  return (
    <section
      className="home-frame home-features-wrap"
      aria-labelledby="home-features-title"
      data-homepage-surface="paper"
    >
      <div className="home-features">
        <h2 id="home-features-title" className="type-h2">
          {t("title")}
        </h2>
        <div className="home-feature-groups">
          {GROUPS.map((group) => (
            <div key={group.key}>
              <h3 className="type-h4 home-feature-group-title">
                {t(`groups.${group.key}`)}
              </h3>
              <ul className="home-feature-list">
                {group.features.map((feature) => (
                  <li key={feature.key}>
                    <GlobalLink
                      href={feature.href}
                      {...homepageLinkAttributes(feature.href)}
                      className="home-feature-row"
                    >
                      <span className="home-feature-icon" aria-hidden="true">
                        <feature.Icon size={21} strokeWidth={1.8} />
                      </span>
                      <span className="home-feature-copy">
                        <strong>{t(`${feature.key}.title`)}</strong>
                        <span>{t(`${feature.key}.text`)}</span>
                      </span>
                      <span className="home-feature-badges">
                        <span
                          className="home-feature-badge"
                          data-access={feature.access}
                        >
                          {t(`badges.${feature.access}`)}
                        </span>
                        {"live" in feature && !feature.live ? (
                          <span
                            className="home-feature-badge"
                            data-access="soon"
                          >
                            {t("badges.soon")}
                          </span>
                        ) : null}
                      </span>
                    </GlobalLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
