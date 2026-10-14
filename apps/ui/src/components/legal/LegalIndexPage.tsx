import { Icon } from "@iconify/react"
import { useTranslations, type Locale } from "next-intl"

import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { LegalDocumentNavItem } from "@/lib/strapi-api/content/server"

import { legalIcon } from "./legal.helpers"

const GROUPS = [
  {
    key: "legal_site",
    slugs: ["terms", "privacy", "cookies", "accessibility"],
  },
  { key: "legal_membership", slugs: ["membership", "cancellation-refunds"] },
  {
    key: "legal_data",
    slugs: ["data-licence", "ai", "ai-statement", "independence"],
  },
] as const

export function LegalIndexPage({
  locale,
  documents,
}: {
  readonly locale: Locale
  readonly documents: LegalDocumentNavItem[]
}) {
  const t = useTranslations("ui")
  const links = documents.filter((doc) => doc.slug)
  const groups = [
    ...GROUPS.map((group) => ({
      key: group.key,
      documents: links.filter((doc) =>
        (group.slugs as readonly string[]).includes(doc.slug!)
      ),
    })),
    {
      key: "legal_other" as const,
      documents: links.filter(
        (doc) =>
          !GROUPS.some((group) =>
            (group.slugs as readonly string[]).includes(doc.slug!)
          )
      ),
    },
  ].filter((group) => group.documents.length > 0)

  return (
    <div style={{ background: T.bg.void, color: T.ink.base }}>
      <GlobalHeader locale={locale} />
      <main>
        <PageHero
          breadcrumb={[
            { label: t("home"), href: "/" },
            { label: t("legal_policies") },
          ]}
          title={t("legal_policies")}
          lead={t("legal_policies_intro")}
        />
        <Container className="grid gap-8 py-10 sm:py-14 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={group.key}>
              <h2
                id={group.key}
                className="m-0 mb-4 text-[26px] font-medium"
                style={{ fontFamily: T.font.serif }}
              >
                {t(group.key)}
              </h2>
              <ul className="m-0 list-none space-y-3 p-0">
                {group.documents.map((doc) => (
                  <li key={doc.documentId}>
                    <GlobalLink
                      href={`/legal/${doc.slug}`}
                      className="flex min-h-20 items-center gap-3 rounded-[18px] border border-(--t-border-line) bg-white p-5 text-[15px] font-semibold no-underline hover:border-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      <Icon
                        aria-hidden="true"
                        className="shrink-0 text-(--t-accent-primary)"
                        height={20}
                        icon={legalIcon(doc.slug)}
                        width={20}
                      />
                      <span className="flex-1">
                        {doc.title || doc.navLabel || doc.slug}
                      </span>
                      <Icon
                        aria-hidden="true"
                        className="shrink-0 text-(--t-ink-dim)"
                        height={18}
                        icon="mdi:arrow-right"
                        width={18}
                      />
                    </GlobalLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 ? (
            <p className="m-0 text-(--t-ink-dim)">{t("legal_unavailable")}</p>
          ) : null}
        </Container>
      </main>
    </div>
  )
}

export default LegalIndexPage
