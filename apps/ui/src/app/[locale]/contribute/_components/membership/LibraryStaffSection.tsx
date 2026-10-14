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

function Benefits({ items }: { readonly items: readonly StaffBenefit[] }) {
  const tUi = useUiTranslations("ui")

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-start gap-3 text-[14.5px] leading-[1.5]"
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
      className="grid gap-6 rounded-[26px] border p-5 sm:p-7 lg:grid-cols-2 lg:gap-8"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <div className="flex flex-col items-start gap-4">
        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold">
          For library staff
        </span>
        <h2
          id="library-staff-h"
          className="m-0 text-[clamp(28px,3vw,36px)] leading-[1.1] tracking-[-0.015em]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          Look after your library’s record,{" "}
          <em className="text-(--t-accent-primary)">free.</em>
        </h2>
        <p className="m-0 text-[14.5px] leading-[1.6] text-(--t-ink-dim)">
          Staff tools come from verification. Paying never makes you a verified
          librarian, and verified librarians never have to pay.
        </p>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {CLAIM_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-2 text-[13.5px] leading-[1.5]"
            >
              <span
                aria-hidden="true"
                className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-(--t-accent-primary)"
              >
                {index + 1}
              </span>
              <span>
                <strong>{step.title}.</strong>{" "}
                <span className="text-(--t-ink-dim)">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <GlobalLink
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[14px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4"
            href={isStaff ? "/staff" : "/contribute/claim"}
          >
            {isStaff ? "Open the staff area" : "Claim your library"}
          </GlobalLink>
          <a
            href="#plan-team"
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            Running a whole service? See Team
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-[20px] border border-(--t-border-line) bg-white p-5">
        <div className="flex justify-between gap-3 text-[14px] font-bold">
          <h3 className="m-0 text-[14px]">{tUi("verified_staff")}</h3>
          <span className="text-(--t-accent-ok)">{tUi("free")}</span>
        </div>
        <p className="m-0 text-[13.5px] leading-relaxed text-(--t-ink-dim)">
          For each library you’re approved for.
        </p>
        <Benefits items={STAFF_BENEFITS} />
        <p className="m-0 mt-auto border-t border-(--t-divider) pt-3 text-[12.5px] leading-[1.6] text-(--t-ink-dim)">
          A verified record means a member of staff looks after its details; it
          never means the library endorses Libraries Global.
        </p>
      </div>
    </section>
  )
}
