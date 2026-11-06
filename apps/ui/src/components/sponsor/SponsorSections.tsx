import { Icon } from "@iconify/react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { EmptyState } from "@/components/ds/EmptyState"
import { Notice } from "@/components/ds/Notice"
import GlobalLink from "@/components/global/GlobalLink"
import { CONTACT_EMAIL } from "@/lib/constants"
import pricing from "@/lib/membership-pricing.json"
import {
  formatSponsorAmount,
  SPONSOR_ANCHORS,
  type SponsorAcknowledgement,
  type SponsorAcknowledgements,
} from "@/lib/sponsor/acknowledgements"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

const PROGRAMMES = [
  { key: "publicAccess", icon: "mdi:earth" },
  { key: "dataQuality", icon: "mdi:check-decagram-outline" },
  { key: "translation", icon: "mdi:translate" },
  { key: "coverage", icon: "mdi:map-marker-radius-outline" },
  { key: "tooling", icon: "mdi:source-branch" },
] as const

const RECOGNITION = ["acknowledgement", "entry", "briefings"] as const
const ANCHOR_TERMS = ["conversation", "contract", "invoice", "tax"] as const

const CARD =
  "rounded-[22px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
const LINK =
  "font-semibold text-(--t-accent-primary) underline underline-offset-4 hover:text-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4"

function Section({
  id,
  title,
  lead,
  children,
}: {
  readonly id: string
  readonly title: string
  readonly lead?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-5"
    >
      <div className="flex max-w-3xl flex-col gap-2">
        <h2 id={`${id}-title`} className="type-h2 m-0">
          {title}
        </h2>
        {lead ? (
          <p className="m-0 text-base leading-[1.6] text-(--t-ink-dim)">
            {lead}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** Programmes a sponsorship funds, with the reporting every sponsor receives. */
export function SponsorProgrammes() {
  const t = useTranslations("sponsorPage.programmes")

  return (
    <Section id="programmes" title={t("title")} lead={t("lead")}>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRAMMES.map(({ key, icon }) => (
          <li key={key} className={`${CARD} flex flex-col gap-2`}>
            <Icon
              aria-hidden="true"
              className="size-10 rounded-xl bg-(--t-accent-chip) p-2.5 text-(--t-accent-primary)"
              height={20}
              icon={icon}
              width={20}
            />
            <h3 className="type-h3 m-0">{t(`items.${key}.title`)}</h3>
            <p className="m-0 text-base leading-[1.6] text-(--t-ink-dim)">
              {t(`items.${key}.body`)}
            </p>
          </li>
        ))}
      </ul>
      <Notice
        icon="mdi:file-chart-outline"
        tone="info"
        title={t("reportingTitle")}
      >
        <p className="m-0">{t("reportingBody")}</p>
      </Notice>
    </Section>
  )
}

/** The three suggested annual anchors, read from the pricing catalogue. */
export function SponsorAmounts() {
  const t = useTranslations("sponsorPage.amounts")
  const locale = useLocale()

  return (
    <Section id="amounts" title={t("title")} lead={t("lead")}>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {SPONSOR_ANCHORS.map((tier) => (
          <li key={tier} className={`${CARD} flex flex-col gap-1`}>
            <h3 className="type-h3 m-0">{t(`tiers.${tier}`)}</h3>
            <p className="m-0 text-base text-(--t-ink-dim)">
              {t.rich("perYear", {
                amount: formatSponsorAmount(pricing.sponsor[tier], locale),
                strong: (chunks) => (
                  <strong className="type-h2 block font-semibold text-(--t-ink-base)">
                    {chunks}
                  </strong>
                ),
              })}
            </p>
          </li>
        ))}
      </ul>
      <ul className="m-0 flex max-w-3xl list-disc flex-col gap-2 pl-5 text-base leading-[1.6] text-(--t-ink-dim)">
        {ANCHOR_TERMS.map((key) => (
          <li key={key}>{t(`terms.${key}`)}</li>
        ))}
      </ul>
    </Section>
  )
}

/** What a sponsor receives, and the limits that keep the index independent. */
export function SponsorRecognition() {
  const t = useTranslations("sponsorPage")
  const locale = useLocale()

  return (
    <>
      <Section id="recognition" title={t("recognition.title")}>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {RECOGNITION.map((key) => (
            <li key={key} className={`${CARD} flex flex-col gap-2`}>
              <h3 className="type-h3 m-0">
                {t(`recognition.items.${key}.title`)}
              </h3>
              <p className="m-0 text-base leading-[1.6] text-(--t-ink-dim)">
                {t(`recognition.items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="independence" title={t("independence.title")}>
        <Notice
          icon="mdi:scale-balance"
          tone="warn"
          title={t("independence.summary")}
        >
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            <li>{t("independence.items.influence")}</li>
            <li>{t("independence.items.charity")}</li>
            <li>
              {t.rich("independence.items.api", {
                price: formatSponsorAmount(pricing.api.month, locale),
                link: (chunks) => (
                  <GlobalLink href="/developers" className={LINK}>
                    {chunks}
                  </GlobalLink>
                ),
              })}
            </li>
          </ul>
        </Notice>
      </Section>
    </>
  )
}

function SponsorEntry({
  sponsor,
}: {
  readonly sponsor: SponsorAcknowledgement
}) {
  const t = useTranslations("sponsorPage.sponsors")
  const logo = sponsor.logo ? formatStrapiMediaUrl(sponsor.logo.url) : null

  return (
    <li className={`${CARD} flex flex-col gap-3`}>
      {logo ? (
        <div className="relative h-16 w-40 max-w-full">
          <Image
            src={logo}
            alt={sponsor.name}
            fill
            sizes="160px"
            className="object-contain object-left"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="type-h3 m-0">
          {sponsor.website ? (
            <a
              href={sponsor.website}
              rel="nofollow noopener noreferrer"
              className={LINK}
            >
              {sponsor.name}
            </a>
          ) : (
            sponsor.name
          )}
        </h3>
        <p className="m-0 text-sm font-semibold text-(--t-ink-dim)">
          {t(`tiers.${sponsor.tier}`)}
        </p>
      </div>
      {sponsor.acknowledgement ? (
        <p className="m-0 text-base leading-[1.6]">{sponsor.acknowledgement}</p>
      ) : null}
    </li>
  )
}

/** Current, consented sponsors from the CMS, with honest empty and error states. */
export function SponsorAcknowledgementList({
  acknowledgements,
}: {
  readonly acknowledgements: SponsorAcknowledgements
}) {
  const t = useTranslations("sponsorPage.sponsors")
  const { status, sponsors } = acknowledgements

  return (
    <Section id="sponsors" title={t("title")} lead={t("lead")}>
      {status === "unavailable" ? (
        <div role="status">
          <Notice
            icon="mdi:cloud-alert-outline"
            tone="warn"
            title={t("unavailable")}
          >
            <p className="m-0">{t("unavailableDetail")}</p>
          </Notice>
        </div>
      ) : sponsors.length === 0 ? (
        <EmptyState
          compact
          icon="mdi:handshake-outline"
          lead={t("empty")}
          detail={t("emptyDetail")}
          className="border border-(--t-border-line) bg-(--t-bg-deep)"
        />
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => (
            <SponsorEntry
              key={`${sponsor.tier}:${sponsor.name}`}
              sponsor={sponsor}
            />
          ))}
        </ul>
      )}
    </Section>
  )
}

/**
 * The enquiry opens the site contact form with "Sponsorship" chosen
 * (ContactModalProvider handles mailto links carrying data-contact-type);
 * without JavaScript the same link opens an email.
 */
export function SponsorEnquiry() {
  const t = useTranslations("sponsorPage.enquire")
  const subject = encodeURIComponent(t("subject"))

  return (
    <Section id="enquire" title={t("title")} lead={t("body")}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}
          data-contact-type="sponsorship"
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-action-primary) px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
        >
          <Icon
            aria-hidden="true"
            height={18}
            icon="mdi:email-outline"
            width={18}
          />
          {t("action")}
        </a>
        <p className="m-0 text-sm text-(--t-ink-dim)">
          {t("email", { email: CONTACT_EMAIL })}
        </p>
      </div>
    </Section>
  )
}
