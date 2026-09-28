import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { planCard, type PlanCard } from "@/lib/plans"

import { IncludeItem, PlanSectionHeader } from "./PlanBits"

const LOOK = {
  public: { icon: "mdi:web", tint: TYPE_TINT.neutral },
  free: { icon: "mdi:account-outline", tint: TYPE_TINT.public },
} as const

function Done({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      className="m-0 flex items-center gap-2 text-[14.5px] font-semibold"
      style={{ color: T.accent.ok }}
    >
      <Icon aria-hidden="true" height={16} icon="mdi:check" width={16} />
      {children}
    </p>
  )
}

function Half({
  plan,
  footer,
}: {
  readonly plan: PlanCard
  readonly footer: React.ReactNode
}) {
  const look = LOOK[plan.key as keyof typeof LOOK]

  return (
    <div className="flex flex-col gap-5 p-6 sm:p-7">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: look.tint.bg, color: look.tint.fg }}
        >
          <Icon height={20} icon={look.icon} width={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="m-0 text-[24px] leading-tight"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {plan.name}
          </h3>
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            {plan.who}
          </p>
        </div>
        <p
          className="m-0 text-[22px]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          Free
        </p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2.5 p-0 sm:grid-cols-2">
        {plan.includes
          .filter((item) => item.kind !== "note")
          .map((item) => (
            <IncludeItem key={item.text} item={item} />
          ))}
      </ul>
      <div className="mt-auto pt-1">{footer}</div>
    </div>
  )
}

/** Public and Free account side by side: everything factual, no payment. */
export function FreePlansCard({ signedIn }: { readonly signedIn: boolean }) {
  const publicPlan = planCard("public")
  const freePlan = planCard("free")

  return (
    <section aria-labelledby="free-plans-h">
      <PlanSectionHeader
        id="free-plans-h"
        title="Free, for everyone"
        sub="Every library fact, with or without an account."
      />
      <div
        className="grid grid-cols-1 overflow-hidden rounded-[22px] border bg-white lg:grid-cols-2"
        style={{ borderColor: T.border.line }}
      >
        <Half plan={publicPlan} footer={<Done>Just start browsing</Done>} />
        <div
          className="border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: T.border.line }}
        >
          <Half
            plan={freePlan}
            footer={
              signedIn ? (
                <Done>You’re signed in</Done>
              ) : freePlan.cta.href ? (
                <GlobalLink
                  className="inline-flex h-10 items-center rounded-full bg-(--t-accent-primary) px-5 text-[14.5px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                  href={freePlan.cta.href}
                >
                  {freePlan.cta.label}
                </GlobalLink>
              ) : null
            }
          />
        </div>
      </div>
    </section>
  )
}
