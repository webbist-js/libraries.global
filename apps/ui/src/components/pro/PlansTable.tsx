import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import {
  type PlanCard,
  type PlanPrice,
  PLANS,
  PRICES_ARE_PLACEHOLDERS,
  priceHeadline,
  showPlanCta,
} from "@/lib/plans"

const SOON_SUFFIX = " (coming soon)"

function Price({ price }: { readonly price: PlanPrice }) {
  const headline = (
    <p
      className="m-0 text-[26px] leading-tight"
      style={{ fontFamily: T.font.serif, fontWeight: 500 }}
    >
      {priceHeadline(price)}
    </p>
  )
  if (price === "free") return headline

  return (
    <div className="flex flex-col gap-1.5">
      {headline}
      {price.monthly && price.yearly ? (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          or {price.yearly}
        </p>
      ) : null}
      {price.note ? (
        <p
          className="m-0 text-[13px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {price.note}
        </p>
      ) : null}
    </div>
  )
}

function IncludesList({ lines }: { readonly lines: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {lines.map((line) => {
        const soon = line.endsWith(SOON_SUFFIX)

        return (
          <li
            key={line}
            className="flex gap-2 text-[14.5px] leading-[1.45]"
            style={{ color: soon ? T.ink.dim : T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              height={16}
              icon={soon ? "mdi:clock-outline" : "mdi:check"}
              style={{ color: soon ? T.ink.dim : T.accent.ok }}
              width={16}
            />
            <span>{line}</span>
          </li>
        )
      })}
    </ul>
  )
}

const PILL =
  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-4 text-[14.5px] font-semibold"

function Cta({ cta }: { readonly cta: PlanCard["cta"] }) {
  switch (cta.kind) {
    case "signup":
    case "contact":
      return cta.href?.startsWith("mailto:") ? (
        <a
          className={`${PILL} bg-(--t-accent-primary) text-white no-underline hover:bg-(--t-accent-primary-hover)`}
          href={cta.href}
        >
          <Icon
            aria-hidden="true"
            height={16}
            icon="mdi:email-outline"
            width={16}
          />
          {cta.label}
        </a>
      ) : (
        <GlobalLink
          className={`${PILL} bg-(--t-accent-primary) text-white no-underline hover:bg-(--t-accent-primary-hover)`}
          href={cta.href}
        >
          {cta.label}
        </GlobalLink>
      )
    case "soon":
      return (
        <button
          className={`${PILL} cursor-not-allowed border bg-white`}
          disabled
          style={{ borderColor: T.border.hi, color: T.ink.dim }}
          type="button"
        >
          <Icon
            aria-hidden="true"
            height={16}
            icon="mdi:clock-outline"
            width={16}
          />
          {cta.label}
        </button>
      )

    default:
      return (
        <p className="m-0 text-center text-[14px]" style={{ color: T.ink.dim }}>
          {cta.label}
        </p>
      )
  }
}

/**
 * The plans, side by side on wide screens and stacked on narrow ones. Server-
 * and client-safe (no hooks). `currentPlan` is the session plan key, or
 * "public" for a signed-out visitor.
 */
export function PlansTable({ currentPlan }: { readonly currentPlan?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PLANS.map((plan) => {
          const current = plan.key === currentPlan

          return (
            <li
              key={plan.key}
              className="flex min-w-0 flex-col gap-4 rounded-[22px] bg-white"
              style={{
                border: current
                  ? `2px solid ${T.accent.primary}`
                  : `1px solid ${T.border.line}`,
                // Keep content aligned whichever border width applies.
                padding: current ? 19 : 20,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  className="m-0 text-[22px] leading-tight"
                  style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                >
                  {plan.name}
                </h3>
                {current ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                    style={{
                      background: T.accent.chip,
                      color: T.accent.primaryHover,
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      height={14}
                      icon="mdi:check-circle"
                      width={14}
                    />
                    Your plan
                  </span>
                ) : null}
              </div>

              <Price price={plan.price} />

              <p
                className="m-0 text-[14.5px] leading-[1.5] font-medium"
                style={{ color: T.ink.dim }}
              >
                {plan.who}
              </p>

              <div
                className="border-t pt-4"
                style={{ borderColor: T.border.divider }}
              >
                <IncludesList lines={plan.includes} />
              </div>

              {showPlanCta(plan, currentPlan) ? (
                <div className="mt-auto pt-2">
                  <Cta cta={plan.cta} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {PRICES_ARE_PLACEHOLDERS ? (
        <p
          className="m-0 flex items-start gap-2 text-[14px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            height={16}
            icon="mdi:information-outline"
            style={{ color: TYPE_TINT.national.fg }}
            width={16}
          />
          <span>
            <strong style={{ color: T.ink.base }}>
              Prices are placeholders.
            </strong>{" "}
            They may change before checkout opens, and nobody is charged until
            then.
          </span>
        </p>
      ) : null}
    </div>
  )
}
