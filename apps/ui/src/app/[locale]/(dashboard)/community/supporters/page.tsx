import { Icon } from "@iconify/react"
import {
  CONTRIBUTOR_REACH_PER_WEEK,
  SUPPORTER_MIN_ACCEPTED,
} from "@repo/access"
import type { Metadata } from "next"
import { headers } from "next/headers"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { SupporterBadge } from "@/components/community/SupporterBadge"
import { SupporterPreferences } from "@/components/community/SupporterPreferences"
import { Avatar } from "@/components/ds/Avatar"
import { Badge } from "@/components/ds/Badge"
import { StatBlock } from "@/components/ds/StatBlock"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import {
  fetchSupporters,
  type SupportersQuery,
} from "@/lib/community/supporters-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"
import { RunningCosts } from "./_components/RunningCosts"
import { SupportersDirectory } from "./_components/SupportersDirectory"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getUiTranslations({
    locale: locale as Locale,
    namespace: "supportersPage",
  })

  return buildMetadata({
    title: t("metaTitle"),
    description: t("metaDescription", { count: SUPPORTER_MIN_ACCEPTED }),
    path: "community/supporters",
    locale,
  })
}

const FAQ_KEYS = [
  "listing",
  "shown",
  "mark",
  "who",
  "buy",
  "revoked",
  "organisations",
] as const

const pill =
  "inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold no-underline"

const STEPS = [
  { key: "first", icon: "mdi:map-marker-plus-outline" },
  { key: "count", icon: "mdi:check-decagram-outline" },
  { key: "milestone", icon: "mdi:heart-outline" },
] as const

export default async function SupportersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale }, raw, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  const [tUi, t] = await Promise.all([
    getUiTranslations("ui"),
    getUiTranslations("supportersPage"),
  ])
  const query: SupportersQuery = {}
  for (const key of ["q", "country", "region", "page"] as const)
    if (typeof raw[key] === "string") query[key] = raw[key]
  // Alphabetical only: nothing records the day someone reached 100.
  query.sort = "name"
  const [data, profile] = await Promise.all([
    fetchSupporters(query),
    session?.user ? fetchOwnProfile(session.user) : Promise.resolve(null),
  ])
  const defaultTitle = t("title")
  const title = data?.title || defaultTitle
  const name =
    profile?.firstName ||
    profile?.username ||
    session?.user?.name?.split(" ")[0] ||
    t("thanksFallbackName")
  const accepted = Number.isSafeInteger(session?.user?.acceptedContributions)
    ? Number(session?.user?.acceptedContributions)
    : null

  return (
    <div style={{ color: T.ink.base }}>
      <CommunitySectionHeader
        section={tUi("supporters")}
        title={title === defaultTitle ? t("titleBroken") : title}
        leadPlacement="left"
        showEyebrow={false}
        lead={data?.lead || t("lead", { count: SUPPORTER_MIN_ACCEPTED })}
        actions={
          <div className="flex flex-wrap gap-2">
            <GlobalLink
              href="/contribute"
              className={pill}
              style={{
                background: T.action.primary,
                borderColor: T.accent.primary,
                color: "white",
              }}
            >
              {t("startContributing")}
            </GlobalLink>
            <a
              href="#our-supporters"
              className={pill}
              style={{
                background: T.bg.deep,
                borderColor: T.border.line,
                color: T.ink.base,
              }}
            >
              {t("seeWho")}
            </a>
          </div>
        }
      >
        {data ? (
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl border p-4"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <StatBlock
                value={data.total.toLocaleString(locale)}
                label={tUi("supporters")}
              />
            </div>
            <div
              className="rounded-2xl border p-4"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <StatBlock
                value={data.countries.length}
                label={tUi("countries")}
              />
            </div>
            <div className="col-span-2">
              <RunningCosts costs={data.costs} locale={locale} />
            </div>
          </div>
        ) : null}
      </CommunitySectionHeader>

      <Container className="flex flex-col gap-14 py-10 sm:gap-16 sm:py-14">
        {profile?.isSupporter ? (
          <section
            aria-label={tUi("your_supporter_visibility")}
            className="flex flex-wrap items-center justify-between gap-5 rounded-[28px] border px-5 py-6 sm:px-7"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <div className="flex items-center gap-4">
              <Avatar
                variant="tint"
                initials={
                  (profile.firstName?.[0] ?? "") +
                    (profile.lastName?.[0] ?? "") ||
                  profile.username?.slice(0, 2) ||
                  "LG"
                }
                size="xl"
              />
              <div>
                <h2 className="type-h2 m-0">{t("thanks", { name })}</h2>
                {accepted !== null ? (
                  <p
                    className="mt-1 mb-0 text-base"
                    style={{ color: T.ink.dim }}
                  >
                    {t("acceptedCount", { count: accepted })}
                  </p>
                ) : null}
                <p className="mt-1 mb-0 text-base" style={{ color: T.ink.dim }}>
                  {profile.profileVisibility === "public" &&
                  profile.username &&
                  profile.supporterListed !== false
                    ? t("listed")
                    : t("notListed")}{" "}
                  {profile.supporterBadgeVisible !== false
                    ? t("markShown")
                    : t("markHidden")}
                </p>
              </div>
            </div>
            <SupporterPreferences
              compact
              key={`${profile.supporterListed}-${profile.supporterBadgeVisible}-${profile.profileVisibility}`}
              listed={profile.supporterListed}
              badgeVisible={profile.supporterBadgeVisible}
              visibility={profile.profileVisibility}
            />
          </section>
        ) : null}

        <section
          aria-labelledby="supporter-recognition"
          className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12"
        >
          <div>
            <h2 id="supporter-recognition" className="type-h2 m-0">
              {t("recognitionTitle")}
            </h2>
            <ul className="mt-7 mb-0 flex list-none flex-col gap-6 p-0">
              <li className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: T.accent.chip, color: T.accent.primary }}
                >
                  <Icon
                    icon="mdi:heart-outline"
                    width={21}
                    height={21}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="m-0 font-semibold">{t("markTitle")}</p>
                  <p
                    className="mt-1 mb-0 text-base"
                    style={{ color: T.ink.dim }}
                  >
                    {t("markBody")}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "var(--tint-public-bg)",
                    color: "var(--tint-public-fg)",
                  }}
                >
                  <Icon
                    icon="mdi:account-group-outline"
                    width={21}
                    height={21}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="m-0 font-semibold">{t("creditTitle")}</p>
                  <p
                    className="mt-1 mb-0 text-base"
                    style={{ color: T.ink.dim }}
                  >
                    {t("creditBody")}
                  </p>
                </div>
              </li>
            </ul>
            <p
              className="mt-6 mb-0 max-w-xl border-t border-(--t-border-line) pt-5 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {t("onPurpose")}
            </p>
          </div>
          <div
            className="rounded-[28px] border p-5 sm:p-7"
            style={{ background: T.bg.space, borderColor: T.border.line }}
          >
            <p
              className="mt-0 mb-4 text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              {t("previewTitle")}
            </p>
            <div
              className="flex flex-col items-start gap-4 rounded-[22px] border p-5 sm:flex-row sm:items-center sm:p-6"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <Avatar initials="YN" variant="tint" tint="academic" size="xl" />
              <div className="min-w-0">
                <p
                  className="mt-0 mb-1 text-[28px] leading-tight"
                  style={{ fontFamily: T.font.sans }}
                >
                  {t("previewName")}
                </p>
                <p className="mt-0 mb-2 text-sm" style={{ color: T.ink.dim }}>
                  {t("previewHandle")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <SupporterBadge />
                  <Badge
                    label={tUi("trusted_contributor")}
                    color="ok"
                    icon="mdi:check"
                  />
                </div>
              </div>
            </div>
            <p
              className="mt-4 mb-0 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {t("previewNote")}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="how-earned"
          className="rounded-3xl border p-5 sm:p-8"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="how-earned" className="type-h2 m-0">
                {t("stepsTitle")}
              </h2>
              <p className="mt-2 mb-0 text-base" style={{ color: T.ink.dim }}>
                {t("stepsLead")}
              </p>
            </div>
            <GlobalLink
              href="/plans"
              className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              style={{ color: T.accent.primary }}
            >
              {t("howAccessWorks")}
            </GlobalLink>
          </div>
          <ol className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.key}
                className="flex items-start gap-3 rounded-[20px] border p-4"
                style={{ background: T.bg.void, borderColor: T.border.line }}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.line,
                    color: T.accent.primary,
                  }}
                >
                  <Icon
                    icon={step.icon}
                    width={22}
                    height={22}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-base leading-snug font-semibold">
                    {t(`steps.${step.key}.title`, {
                      count: SUPPORTER_MIN_ACCEPTED,
                    })}
                  </p>
                  <p
                    className="mt-1.5 mb-0 text-sm leading-[1.5]"
                    style={{ color: T.ink.dim }}
                  >
                    {t(`steps.${step.key}.body`, {
                      count: CONTRIBUTOR_REACH_PER_WEEK,
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <SupportersDirectory
          key={JSON.stringify({ data, query })}
          data={data}
          query={query}
          locale={locale}
        />

        <section
          aria-labelledby="listing-faq"
          className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]"
        >
          <h2 id="listing-faq" className="type-h2 m-0">
            {t("faqTitle")}
          </h2>
          <div
            className="rounded-[22px] border bg-(--t-bg-deep)"
            style={{ borderColor: T.border.line }}
          >
            {FAQ_KEYS.map((key, i) => (
              <details
                key={key}
                className="group"
                style={
                  i > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
                  {t(`faq.${key}.q`)}
                  <Icon
                    aria-hidden="true"
                    className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    height={20}
                    icon="mdi:chevron-down"
                    style={{ color: T.ink.dim }}
                    width={20}
                  />
                </summary>
                <p
                  className="m-0 max-w-[72ch] px-5 pb-5 text-base leading-[1.6] sm:px-6"
                  style={{ color: T.ink.dim }}
                >
                  {t(`faq.${key}.a`, { count: SUPPORTER_MIN_ACCEPTED })}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="sponsor-service"
          className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border p-7 sm:p-10"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <div>
            <h2 id="sponsor-service" className="type-h2 m-0">
              {t("sponsorTitle")}
            </h2>
            <p
              className="mt-3 mb-0 max-w-xl text-base leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {t("sponsorBody")}
            </p>
          </div>
          <GlobalLink
            href="/sponsor"
            className={pill}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {t("sponsorAction")}
          </GlobalLink>
        </section>

        <section
          className="flex flex-wrap items-center justify-between gap-6 rounded-3xl p-7 sm:p-10"
          style={{ background: T.bg.inverse, color: T.ink.inverse }}
        >
          <div>
            <h2 className="type-h2 m-0">{t("closingTitle")}</h2>
            <p
              className="mt-3 mb-0 max-w-xl text-base leading-relaxed"
              style={{ color: T.ink.onDark }}
            >
              {t("closingBody", { count: CONTRIBUTOR_REACH_PER_WEEK })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GlobalLink
              href="/contribute"
              className={pill}
              style={{ background: T.bg.deep, color: T.ink.base }}
            >
              {t("startContributing")}
            </GlobalLink>
            <GlobalLink
              href="/plans"
              className={pill}
              style={{ borderColor: T.ink.dim, color: T.ink.inverse }}
            >
              {t("howAccessWorks")}
            </GlobalLink>
          </div>
        </section>
      </Container>
    </div>
  )
}
