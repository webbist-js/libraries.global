import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { PLAN_TEASERS, planCard } from "@/lib/plans"

type Teaser = (typeof PLAN_TEASERS)[number]

/** The card's one action, or null when the viewer already has what it offers. */
function teaserCta(
  key: Teaser["key"],
  viewerPlan: string | undefined
): { label: string; href: string } | null {
  switch (key) {
    case "public":
      return { label: "Start exploring", href: "/libraries" }
    case "free":
      return viewerPlan
        ? null
        : { label: "Create account", href: "/auth/register" }
    case "pro":
      return { label: "See Pro", href: "/contribute/membership" }
    case "team":
      return { label: "Create your Team", href: "/staff/team/new" }
  }
}

/** Library facts stay free; plans fund analysis. A teaser for the
 * Membership page, not a pricing table: no amounts here. */
export function PlansSection({
  intro,
  viewerPlan,
}: {
  readonly intro: SectionIntro
  /** The signed-in viewer's plan key; undefined for a visitor. */
  readonly viewerPlan?: string
}) {
  if (!intro.title) return null

  return (
    <section
      aria-labelledby="plans-title"
      data-homepage-surface="paper"
      className="mx-auto w-full max-w-[1360px] px-4 sm:px-8"
    >
      <div
        className="rounded-[32px] border px-[clamp(20px,5vw,72px)] py-[clamp(32px,5vw,72px)]"
        style={{ background: T.bg.space, borderColor: T.border.line }}
      >
        <div className="mb-10 max-w-[760px]">
          <SectionHeader id="plans-title" intro={intro} size="band" />
          <GlobalLink
            href="/contribute/membership"
            {...analyticsAttributes("membership_interest", {
              interaction_source: "home_plans",
              action_type: "compare",
            })}
            className="-mt-4 inline-block font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Compare all plans
          </GlobalLink>
        </div>

        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_TEASERS.map((teaser) => {
            const { name } = planCard(teaser.key)
            const highlight = teaser.key === "pro"
            const current = viewerPlan === teaser.key
            const cta = teaserCta(teaser.key, viewerPlan)

            return (
              <li
                key={teaser.key}
                className="flex flex-col gap-1.5 rounded-[20px] border bg-white p-5"
                style={{
                  borderColor: highlight ? T.accent.primary : T.border.line,
                  borderWidth: highlight ? 2 : 1,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    className="m-0 text-[24px] leading-[1.15]"
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 500,
                      color: T.ink.base,
                    }}
                  >
                    {name}
                  </h3>
                  {current ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                      style={{ background: "#E6EFE6", color: "#2F5D3A" }}
                    >
                      Your plan
                    </span>
                  ) : highlight ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                      style={{
                        background: T.accent.chip,
                        color: T.accent.primary,
                      }}
                    >
                      Most useful
                    </span>
                  ) : null}
                </div>
                <p
                  className="m-0 text-[14px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {teaser.tagline}
                </p>
                <p
                  className="m-0 text-[15px] leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  {teaser.summary}
                </p>
                {cta && !current ? (
                  <span className="mt-auto pt-3">
                    <GlobalLink
                      href={cta.href}
                      {...(teaser.key === "pro" || teaser.key === "team"
                        ? analyticsAttributes("membership_interest", {
                            interaction_source: "home_plans",
                            action_type: "compare",
                          })
                        : {})}
                      className={
                        highlight
                          ? "inline-block rounded-full px-4 py-2 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                          : "inline-block rounded-full border bg-white px-4 py-2 text-[15px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
                      }
                      style={
                        highlight
                          ? { background: T.accent.primary }
                          : { borderColor: T.border.hi, color: T.ink.base }
                      }
                    >
                      {cta.label}
                    </GlobalLink>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

PlansSection.displayName = "PlansSection"

export default PlansSection
