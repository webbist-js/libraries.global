import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { ProFaq } from "@/app/[locale]/contribute/_components/membership/ProFaq"
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
import { FREE_FEATURE_SUMMARIES } from "@/lib/plans"
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

  return buildMetadata({
    title: "Supporters",
    description:
      "The people helping keep Libraries Global open. Explore what stays free and choose whether your support is shown publicly.",
    path: "community/supporters",
    locale,
  })
}

const FAQ_PAIRS = [
  [
    "Do I have to be listed?",
    "No. Switch off listing here or in your profile settings. Private and limited profiles are never listed. If you make your profile public again, choose whether to turn listing back on.",
  ],
  [
    "What shows next to my name?",
    "Your display name links to your public profile. Your city and country appear only if you show your location publicly. Your plan, payment amount, email and billing details are never shown.",
  ],
  [
    "Can I hide the Supporter mark?",
    "Yes. The mark has its own switch in profile settings. Hiding it does not change whether you are listed on this page.",
  ],
  [
    "Who can appear here?",
    "People with an active Supporter, Pro or Team plan, including complimentary Pro, earned Pro and active Team seats. Everyone gets the same optional mark. Recognition never changes contributor roles or how reviews work.",
  ],
  [
    "What happens when my plan ends?",
    "Once your plan access ends, your listing and profile mark disappear. Your visibility choices are kept for the next time you have an eligible plan.",
  ],
  [
    "Can organisations support?",
    "Yes. The Team plan is for library services and other organisations. Active members can choose to appear here using their individual public profiles. Contact us from the Membership page to arrange a Team.",
  ],
] as const
const FAQ = FAQ_PAIRS.map(([q, a]) => ({ q, a }))

const heading = {
  fontFamily: T.font.serif,
  fontWeight: 500,
  fontSize: "clamp(30px,3vw,42px)",
  lineHeight: 1.1,
}
const pill =
  "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-[14px] font-semibold no-underline"

export default async function SupportersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, raw, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  const query: SupportersQuery = {}
  for (const key of ["q", "country", "region", "sort", "page"] as const)
    if (typeof raw[key] === "string") query[key] = raw[key]
  const [data, profile] = await Promise.all([
    fetchSupporters(query),
    session?.user ? fetchOwnProfile(session.user) : Promise.resolve(null),
  ])
  const title = data?.title || "The people who *keep it open.*"
  const name =
    profile?.firstName ||
    profile?.username ||
    session?.user?.name?.split(" ")[0] ||
    "there"

  return (
    <div style={{ color: T.ink.base }}>
      <CommunitySectionHeader
        section={tUi("supporters")}
        title={
          title === "The people who *keep it open.*"
            ? "The people\nwho *keep it open.*"
            : title
        }
        leadPlacement="left"
        showEyebrow={false}
        showTabs={false}
        lead={
          data?.lead ||
          "Support helps cover the servers, maps and data behind Libraries Global. Library records, downloads and community contributions stay free for everyone."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <GlobalLink
              href="/contribute/membership"
              className={pill}
              style={{
                background: T.accent.primary,
                borderColor: T.accent.primary,
                color: "white",
              }}
            >
              Become a supporter
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
              See who&apos;s here
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
                <h2
                  className="m-0 text-[30px] leading-tight"
                  style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                >
                  Thank you, {name}.
                </h2>
                <p
                  className="mt-1 mb-0 text-[15px]"
                  style={{ color: T.ink.dim }}
                >
                  {profile.profileVisibility === "public" &&
                  profile.username &&
                  profile.supporterListed !== false
                    ? "You're credited below."
                    : "Your name is not listed publicly."}{" "}
                  {profile.supporterBadgeVisible !== false
                    ? "Your profile shows the Supporter mark."
                    : "Your Supporter mark is hidden."}
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
          aria-labelledby="supporter-benefits"
          className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        >
          <div>
            <h2 id="supporter-benefits" className="m-0" style={heading}>
              What supporters get
            </h2>
            <ul className="mt-6 flex list-none flex-col gap-5 p-0">
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
                  <p className="m-0 font-semibold">
                    An optional Supporter mark
                  </p>
                  <p
                    className="mt-1 mb-0 text-[15px]"
                    style={{ color: T.ink.dim }}
                  >
                    Shown beside your name on your profile. Hide it any time in
                    Settings.
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
                  <p className="m-0 font-semibold">Credit on this page</p>
                  <p
                    className="mt-1 mb-0 text-[15px]"
                    style={{ color: T.ink.dim }}
                  >
                    Your display name and, if your profile shows it, your
                    location. Listing is your choice.
                  </p>
                </div>
              </li>
            </ul>
            <p
              className="mb-0 max-w-xl text-[14px] leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              That&apos;s all, on purpose. Supporting doesn&apos;t change what
              you can edit or how reviews work. Trust comes from accurate
              changes, not payment.
            </p>
          </div>
          <div
            className="rounded-[28px] border p-6"
            style={{ background: T.bg.space, borderColor: T.border.line }}
          >
            <p
              className="mt-0 text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              How the badge looks on a profile
            </p>
            <div
              className="flex items-center gap-4 rounded-[22px] border p-5"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <Avatar initials="YN" variant="tint" tint="academic" size="xl" />
              <div className="min-w-0">
                <p
                  className="mt-0 mb-1 text-[28px] leading-tight"
                  style={{ fontFamily: T.font.serif }}
                >
                  Your name
                </p>
                <p
                  className="mt-0 mb-2 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  @yourname · Your public location
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
            <p className="mt-3 mb-0 text-[13px]" style={{ color: T.ink.dim }}>
              The mark never shows how much someone pays. It&apos;s off your
              profile the moment you hide it.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="keeps-free"
          className="rounded-3xl border p-5 sm:p-8"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="keeps-free" className="m-0" style={heading}>
                What support keeps{" "}
                <em className="ml-1" style={{ color: T.accent.primary }}>
                  free.
                </em>
              </h2>
              <p className="mt-2 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
                For everyone, with or without a plan.
              </p>
            </div>
            <GlobalLink
              href="/contribute/membership"
              className="text-[14px] font-semibold underline underline-offset-4"
              style={{ color: T.accent.primary }}
            >
              Compare all plans
            </GlobalLink>
          </div>
          <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {FREE_FEATURE_SUMMARIES.map((feature) => (
              <li
                key={feature.title}
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
                    icon={feature.icon}
                    width={22}
                    height={22}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-1.5 text-[15px] leading-snug font-semibold">
                    {feature.title}
                    {feature.planned ? (
                      <Badge label={tUi("planned")} color="dim" />
                    ) : null}
                  </p>
                  <p
                    className="mt-1.5 mb-0 text-[14px] leading-[1.5]"
                    style={{ color: T.ink.dim }}
                  >
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <SupportersDirectory
          key={JSON.stringify({ data, query })}
          data={data}
          query={query}
          locale={locale}
        />

        <ProFaq
          id="listing-faq"
          title="About being listed"
          items={FAQ}
          showContact={false}
          firstOpen={false}
        />

        <section
          className="flex flex-wrap items-center justify-between gap-6 rounded-3xl p-7 sm:p-10"
          style={{ background: T.ink.base, color: T.bg.deep }}
        >
          <div>
            <h2
              className="m-0 text-[clamp(30px,4vw,46px)] leading-tight"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              Add your name to the <em>list.</em>
            </h2>
            <p
              className="mt-3 mb-0 max-w-xl text-[15px] leading-relaxed"
              style={{ color: T.ink.onDark }}
            >
              Supporter is our lowest paid plan, with an optional Supporter mark
              and credit on this page. Paid checkout is coming soon.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GlobalLink
              href="/contribute/membership"
              className={pill}
              style={{ background: T.bg.deep, color: T.ink.base }}
            >
              Become a supporter
            </GlobalLink>
            <GlobalLink
              href="/contribute/membership"
              className={pill}
              style={{ borderColor: T.ink.dim, color: T.bg.deep }}
            >
              Compare plans
            </GlobalLink>
          </div>
        </section>
      </Container>
    </div>
  )
}
