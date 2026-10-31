import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import type {
  CtaBand,
  LinkCard,
  SectionIntro,
} from "@/components/home/homepage.types"

// Shipped CMS headings in each supported locale. Custom editorial cards keep
// their own topic in the CTA rather than inheriting a label from their position.
const TRUST_TOPICS = new Map<string, "sources" | "review" | "gaps" | "reuse">([
  ["sources", "sources"],
  ["zdroje", "sources"],
  ["review", "review"],
  ["relecture", "review"],
  ["kontrola", "review"],
  ["gaps", "gaps"],
  ["lacunes", "gaps"],
  ["mezery", "gaps"],
  ["reuse", "reuse"],
  ["réutilisation", "reuse"],
  ["další využití", "reuse"],
])

export function ClosingSection({
  band,
  trustItems,
  openLinks,
  plansIntro,
}: {
  readonly band: CtaBand
  readonly trustItems: readonly LinkCard[]
  readonly openLinks: readonly LinkCard[]
  readonly plansIntro: SectionIntro
}) {
  const t = useTranslations("homepageTrust")

  return (
    <section className="home-closing" aria-labelledby="home-closing-title">
      <div className="home-frame home-closing-grid">
        <div>
          <h2
            id="home-closing-title"
            className="type-display-closing font-semibold"
          >
            <Emphasis text={band.title ?? ""} />
          </h2>
          <p className="home-section-copy">{band.text}</p>
          <div className="home-inline-links">
            <GlobalLink
              href={band.primaryHref}
              {...homepageLinkAttributes(band.primaryHref)}
              className="home-button home-button-light"
            >
              {band.primaryLabel}
            </GlobalLink>
            <GlobalLink
              href={band.secondaryHref}
              {...homepageLinkAttributes(band.secondaryHref)}
              className="home-button home-button-outline"
            >
              {band.secondaryLabel}
            </GlobalLink>
            <GlobalLink
              href="/plans"
              {...homepageLinkAttributes("/plans")}
              className="home-button home-button-outline"
              title={plansIntro.text ?? undefined}
            >
              Plans
            </GlobalLink>
          </div>
        </div>
        <div className="home-trust-grid">
          {trustItems.map((item) => {
            const topic = TRUST_TOPICS.get(
              item.title?.trim().toLowerCase() ?? ""
            )

            return (
              <div key={item.title}>
                <h3 className="type-h3">{item.title}</h3>
                <p>{item.text}</p>
                <GlobalLink
                  href={item.href}
                  {...homepageLinkAttributes(item.href)}
                >
                  {topic
                    ? t(topic)
                    : t("readAbout", { topic: item.title ?? "" })}
                </GlobalLink>
              </div>
            )
          })}
        </div>
      </div>
      <nav className="home-frame home-open-links" aria-label="Open by design">
        {openLinks.map((link) => (
          <GlobalLink
            key={link.title}
            href={link.href}
            {...homepageLinkAttributes(link.href)}
          >
            {link.title}
          </GlobalLink>
        ))}
      </nav>
    </section>
  )
}

export default ClosingSection
