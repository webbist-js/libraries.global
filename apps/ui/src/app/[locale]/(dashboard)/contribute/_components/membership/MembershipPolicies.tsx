import { ArrowUpRight } from "lucide-react"
import { getTranslations } from "next-intl/server"

import GlobalLink from "@/components/global/GlobalLink"

export async function MembershipPolicies() {
  const t = await getTranslations("billing")

  return (
    <section
      aria-labelledby="membership-policies-heading"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <h2 id="membership-policies-heading" className="type-h2 m-0">
          {t("legalHeading")}
        </h2>
        <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {t("legalLead")} {t("termsLanguageNote")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            [
              "membership-terms",
              "/legal/membership",
              "membershipTerms",
              "legalTermsBody",
            ],
            [
              "cancellation-refunds",
              "/legal/cancellation-refunds",
              "cancellationPolicy",
              "legalRefundsBody",
            ],
          ] as const
        ).map(([id, href, title, body]) => (
          <article key={id} id={id} className="scroll-mt-24">
            <GlobalLink
              href={href}
              className="flex h-full items-start justify-between gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-6 hover:border-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <div className="flex flex-col gap-2">
                <h3 className="type-h3 m-0 text-(--t-accent-primary)">
                  {t(title)}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {t(body)}
                </p>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-(--t-accent-primary)"
                aria-hidden="true"
              />
            </GlobalLink>
          </article>
        ))}
      </div>
    </section>
  )
}
