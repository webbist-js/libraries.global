import { Icon } from "@iconify/react"
import { useTranslations, type Locale } from "next-intl"

import { InformationPage } from "@/components/dashboard/InformationPage"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
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
    <InformationPage
      title={t("legal_policies")}
      links={links.map((doc) => ({
        href: `/legal/${doc.slug}`,
        label: doc.navLabel || doc.title || doc.slug!,
      }))}
    >
      <MainContent>
        <PageHero
          variant="card"
          title={t("legal_policies")}
          lead={t("legal_policies_intro")}
        />
        <Container className="grid items-start gap-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={group.key}>
              <h2 id={group.key} className="type-h2 m-0 mb-5">
                {t(group.key)}
              </h2>
              <ul className="m-0 list-none space-y-3 p-0">
                {group.documents.map((doc) => (
                  <li key={doc.documentId}>
                    <GlobalLink
                      href={`/legal/${doc.slug}`}
                      className="group flex min-h-20 items-center gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-base leading-relaxed font-medium no-underline transition-colors hover:border-(--t-accent-primary)/40 hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-10 shrink-0 rounded-xl bg-(--t-accent-chip) p-2.5 text-(--t-accent-primary)"
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
      </MainContent>
    </InformationPage>
  )
}

export default LegalIndexPage
