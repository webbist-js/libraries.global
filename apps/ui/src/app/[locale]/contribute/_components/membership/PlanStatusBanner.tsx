import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { useMembershipPlan } from "@/lib/localized-plans"

const LINK =
  "inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-4 text-[14px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none"

const SOURCE_COPY = {
  grant: "grantDetail",
  earned: "earnedDetail",
  verified: "verifiedDetail",
  team: "teamDetail",
  paid: "paidDetail",
} as const

function membershipAction(
  source: keyof typeof SOURCE_COPY | null,
  hasPaidMembership: boolean,
  isStaff: boolean
) {
  if (hasPaidMembership || source === "paid")
    return {
      label: "manageMembership",
      href: "/profile/settings#membership",
    } as const
  if (source === "earned")
    return { label: "contributions", href: "/contribute/submissions" } as const
  if (source === "team" || isStaff)
    return { label: "staffArea", href: "/staff" } as const

  return {
    label: "membershipSettings",
    href: "/profile/settings#membership",
  } as const
}

/** Members see this inside their summary; prospective members see it once below the plans. */
export function MembershipRecognition({
  compact = false,
}: {
  readonly compact?: boolean
}) {
  const t = useTranslations("membershipStatus")
  const Heading = compact ? "h3" : "h2"

  return (
    <section
      aria-labelledby="member-recognition-h"
      className={
        compact
          ? "border-t border-(--t-border-line) bg-(--t-bg-surface) p-5 sm:p-6 lg:border-t-0 lg:border-l"
          : "rounded-[22px] border border-(--t-border-line) bg-(--t-bg-space) p-5 sm:p-6"
      }
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          icon="mdi:account-circle-outline"
          width={20}
          height={20}
          className="shrink-0 text-(--t-accent-primary)"
        />
        <Heading
          id="member-recognition-h"
          className={
            compact
              ? "m-0 text-[16px] font-semibold"
              : "m-0 font-serif text-[26px] leading-tight"
          }
        >
          {t("recognition")}
        </Heading>
      </div>
      <p className="m-0 mt-2 text-[14px] leading-relaxed text-(--t-ink-dim)">
        {compact ? t("recognitionMember") : t("recognitionLead")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {compact ? (
          <GlobalLink className={LINK} href="/profile/settings#privacy">
            {t("recognitionSettings")}
            <Icon aria-hidden icon="mdi:arrow-right" width={16} height={16} />
          </GlobalLink>
        ) : null}
        <GlobalLink
          href="/community/supporters"
          className="inline-flex min-h-11 items-center text-[14px] font-semibold text-(--t-accent-primary) underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("meetSupporters")}
        </GlobalLink>
      </div>
    </section>
  )
}

/** One summary for current access, its source, management and recognition. */
export function PlanStatusBanner({
  plan,
  planSource,
  hasPaidMembership = false,
  isStaff = false,
}: {
  readonly plan?: string | null
  readonly planSource?: string | null
  readonly hasPaidMembership?: boolean
  readonly isStaff?: boolean
}) {
  const planCard = useMembershipPlan()
  const t = useTranslations("membershipStatus")
  if (plan !== "supporter" && plan !== "pro" && plan !== "team") return null
  const source =
    planSource && Object.hasOwn(SOURCE_COPY, planSource)
      ? (planSource as keyof typeof SOURCE_COPY)
      : null
  const complimentary =
    source === "grant" || source === "earned" || source === "verified"
  const action = membershipAction(source, hasPaidMembership, isStaff)

  return (
    <section
      aria-labelledby="current-membership-h"
      className="grid overflow-hidden rounded-[24px] border border-(--t-border-line) bg-white lg:grid-cols-[1.2fr_1fr]"
    >
      <div className="flex min-w-0 items-start gap-3 p-5 sm:gap-4 sm:p-6">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)"
        >
          <Icon height={23} icon="mdi:check-decagram-outline" width={23} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="current-membership-h"
            className="m-0 scroll-mt-28 text-[12px] font-semibold text-(--t-ink-dim)"
          >
            {t("yourMembership")}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="m-0 font-serif text-[30px] leading-tight">
              {planCard(plan).name}
            </p>
            {source ? (
              <span className="rounded-full bg-(--t-accent-chip) px-2.5 py-1 text-[12px] font-semibold text-(--t-accent-primary)">
                {complimentary
                  ? t("complimentary")
                  : source === "team"
                    ? t("teamSeat")
                    : t("paidMembership")}
              </span>
            ) : null}
          </div>
          <p className="m-0 mt-2 max-w-[55ch] text-[14px] leading-relaxed text-(--t-ink-dim)">
            {t(source ? SOURCE_COPY[source] : "unknownDetail")}
          </p>
          <GlobalLink className={`${LINK} mt-4`} href={action.href}>
            {t(action.label)}
            <Icon aria-hidden icon="mdi:arrow-right" width={16} height={16} />
          </GlobalLink>
        </div>
      </div>
      <MembershipRecognition compact />
    </section>
  )
}
