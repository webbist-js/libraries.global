import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { useMembershipContent, useMembershipPlan } from "@/lib/localized-plans"
import type { PlanCard } from "@/lib/plans"

import { IncludeItem, PlanSectionHeader } from "./PlanBits"

const LOOK = {
  public: { icon: "mdi:web", tint: TYPE_TINT.neutral },
  free: { icon: "mdi:account-outline", tint: TYPE_TINT.public },
} as const

function Done({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      className="m-0 flex items-center gap-2 text-sm font-medium"
      style={{ color: T.ink.dim }}
    >
      <Icon
        aria-hidden="true"
        height={16}
        icon="mdi:check"
        style={{ color: T.accent.ok }}
        width={16}
      />
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
  const tUi = useUiTranslations("ui")

  const look = LOOK[plan.key as keyof typeof LOOK]

  return (
    <div className="flex h-full flex-col gap-5 p-6 sm:p-7">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: look.tint.bg, color: look.tint.fg }}
        >
          <Icon height={20} icon={look.icon} width={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-h3 m-0">{plan.name}</h3>
          <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
            {plan.who}
          </p>
        </div>
        <p
          className="m-0 text-[22px]"
          style={{ fontFamily: T.font.sans, fontWeight: 500 }}
        >
          {tUi("free")}
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {plan.includes
          .filter((item) => item.kind !== "note")
          .map((item) => (
            <IncludeItem key={item.text} item={item} />
          ))}
      </ul>
      <div
        className="mt-auto border-t pt-4"
        style={{ borderColor: T.border.divider }}
      >
        {footer}
      </div>
    </div>
  )
}

/** Public and Free account side by side: everything factual, no payment. */
export function FreePlansCard({ signedIn }: { readonly signedIn: boolean }) {
  const m = useMembershipContent()
  const planCard = useMembershipPlan()
  const tUi = useUiTranslations("ui")

  const publicPlan = planCard("public")
  const freePlan = planCard("free")

  return (
    <section aria-labelledby="free-plans-h">
      <PlanSectionHeader
        id="free-plans-h"
        title={tUi("free_for_everyone")}
        sub={m("copy.freeLead")}
      />
      <div
        className="grid grid-cols-1 overflow-hidden rounded-[22px] border bg-(--t-bg-deep) lg:grid-cols-2"
        style={{ borderColor: T.border.line }}
      >
        <Half plan={publicPlan} footer={<Done>{m("copy.browse")}</Done>} />
        <div
          className="border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: T.border.line }}
        >
          <Half
            plan={freePlan}
            footer={
              signedIn ? (
                <Done>{m("copy.signedIn")}</Done>
              ) : freePlan.cta.href ? (
                <GlobalLink
                  className="inline-flex h-10 items-center rounded-full bg-(--t-action-primary) px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover)"
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
