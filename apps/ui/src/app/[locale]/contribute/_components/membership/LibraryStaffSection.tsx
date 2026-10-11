import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"

import { ComingSoonChip } from "./PlanBits"

const CLAIM_STEPS = [
  {
    title: "Claim your library",
    body: "From the library’s page, with your work email.",
  },
  {
    title: "We check with the library",
    body: "Usually within 5 working days.",
  },
  {
    title: "Your staff tools switch on",
    body: "In the Staff area, for that library only.",
  },
] as const

type StaffBenefit = {
  readonly label: string
  readonly badge?: "mobile" | "soon"
}

const STAFF_BENEFITS: readonly StaffBenefit[] = [
  { label: "Edit your library’s record directly" },
  { label: "Post notices and closures" },
  { label: "See and answer suggested changes" },
  { label: "Keep a timetable and go live", badge: "mobile" },
  { label: "Pro, free while you’re verified" },
]

const TEAM_BENEFITS: readonly StaffBenefit[] = [
  { label: "Invite colleagues and give them roles" },
  { label: "Choose who can go live on mobile libraries" },
  { label: "Pro for every seat" },
  { label: "Traffic reports for your libraries", badge: "soon" },
]

const CARD_HEADING_STYLE = {
  fontFamily: T.font.serif,
  fontSize: "clamp(26px,2.6vw,30px)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.1,
} as const

function Benefits({ items }: { readonly items: readonly StaffBenefit[] }) {
  const tUi = useUiTranslations("ui")

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-start gap-3 text-[16px] leading-[1.45]"
        >
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            height={18}
            icon={item.badge === "soon" ? "mdi:clock-outline" : "mdi:check"}
            style={{ color: item.badge === "soon" ? T.ink.dim : T.accent.ok }}
            width={18}
          />
          <span>
            {item.label}
            {item.badge === "mobile" ? (
              <span
                className="ml-1 inline-flex rounded-full px-2 py-px align-[1px] text-[12px] leading-[1.4] font-semibold whitespace-nowrap"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                {tUi("mobile_libraries")}
              </span>
            ) : null}
            {item.badge === "soon" ? (
              <ComingSoonChip label={tUi("soon")} />
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function LibraryStaffSection({
  isStaff,
}: {
  readonly isStaff: boolean
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section
      aria-labelledby="library-staff-h"
      className="flex flex-col gap-8 rounded-[28px] border p-5 sm:rounded-[32px] sm:p-8 lg:p-10"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <p
            className="m-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon="mdi:bank-outline"
              style={{ color: TYPE_TINT.national.fg }}
              width={16}
            />
            For library staff
          </p>
          <h2
            id="library-staff-h"
            className="mt-[16px] mb-[24px] text-[clamp(36px,4.5vw,60px)] leading-[0.98] tracking-[-0.035em]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            Look after your
            <br />
            library&rsquo;s record,{" "}
            <em style={{ color: T.accent.primary }}>free.</em>
          </h2>
          <p
            className="m-0 max-w-[68ch] text-[17px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            Staff tools come from verification, not from a plan. Paying never
            makes you a verified librarian, and verified librarians never have
            to pay.
          </p>
        </div>
        <GlobalLink
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-(--t-accent-primary) px-6 py-3 text-[16px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
          href={isStaff ? "/staff" : "/contribute/claim"}
        >
          {isStaff ? "Open the staff area" : "Claim your library"}
        </GlobalLink>
      </div>

      <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-3">
        {CLAIM_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-[20px] border p-4 sm:p-5"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="m-0 text-[16px] leading-[1.4] font-bold">
                {step.title}
              </h3>
              <p
                className="m-0 mt-1 text-[15px] leading-[1.45]"
                style={{ color: T.ink.dim }}
              >
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="flex min-w-0 flex-col gap-5 rounded-[24px] border p-5 sm:p-7"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="m-0" style={CARD_HEADING_STYLE}>
              {tUi("verified_staff")}
            </h3>
            <span
              className="text-[14px] font-bold"
              style={{ color: T.accent.ok }}
            >
              {tUi("free")}
            </span>
          </div>
          <p
            className="m-0 text-[15px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            Every verified member of staff, for each library they&rsquo;re
            approved for.
          </p>
          <Benefits items={STAFF_BENEFITS} />
          <p
            className="m-0 mt-auto flex items-start gap-2 pt-3 text-[14px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              height={16}
              icon="mdi:shield-check-outline"
              style={{ color: T.accent.primary }}
              width={16}
            />
            <span>
              Verified staff can also get Pro free.{" "}
              <a
                className="font-semibold underline underline-offset-[3px]"
                href="#get-pro-free"
                style={{ color: T.accent.primary }}
              >
                See below
              </a>
            </span>
          </p>
        </div>

        <div
          className="flex min-w-0 flex-col gap-5 rounded-[24px] border p-5 sm:p-7"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="m-0" style={CARD_HEADING_STYLE}>
              Your whole service
            </h3>
            <span
              className="shrink-0 text-[14px] font-bold"
              style={{ color: T.accent.primaryHover }}
            >
              {tUi("team_plan")}
            </span>
          </div>
          <p
            className="m-0 text-[15px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            For library services that want one place to organise their staff.
            Bought per service, not per person.
          </p>
          <Benefits items={TEAM_BENEFITS} />
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-[14.5px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
              href="#plan-team"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              See the Team plan
            </a>
            <p
              className="m-0 text-[14px] leading-[1.5]"
              style={{ color: T.ink.dim }}
            >
              Public library services get 20% off.
            </p>
          </div>
        </div>
      </div>

      <p
        className="m-0 max-w-[95ch] text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Whichever you use, a verified record never means the library endorses
        Libraries Global. It means a member of its staff looks after the
        details.
      </p>
    </section>
  )
}
