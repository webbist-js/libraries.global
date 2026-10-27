import type { ReactNode } from "react"

import { ContributionNextSteps } from "@/components/contribute/ContributionNextSteps"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export type ContributionAlternative = {
  title: string
  href: string
  description?: string
}

export function FeaturedContribution({
  title,
  description,
  action,
  alternatives = [],
  alternativesTitle = "Other ways to help",
  next,
  steps,
  secondary,
}: {
  readonly title: string
  readonly description: string
  readonly action: ReactNode
  readonly alternatives?: readonly ContributionAlternative[]
  readonly alternativesTitle?: string
  readonly next?: string
  readonly steps?: readonly string[]
  readonly secondary?: ReactNode
}) {
  return (
    <section
      aria-label="Help improve this record"
      className="grid gap-7 rounded-[28px] border p-6 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,.95fr)] lg:gap-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex flex-col items-start gap-3.5">
        <p
          className="m-0 text-sm font-semibold"
          style={{ color: T.accent.primary }}
        >
          Where you could help
        </p>
        <h2
          className="type-h2 m-0 text-balance"
          style={{
            color: T.ink.base,
          }}
        >
          {title}
        </h2>
        <p
          className="m-0 max-w-[52ch] text-base leading-[1.6] text-pretty"
          style={{ color: T.ink.dim }}
        >
          {description}
        </p>
        <div className="mt-1 flex flex-col items-start gap-2.5">
          {action}
          {secondary}
        </div>
      </div>
      <div
        className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7"
        style={{ borderColor: T.border.line }}
      >
        {next ? (
          <>
            <h3 className="type-small-heading m-0">What happens next</h3>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {next}
            </p>
          </>
        ) : (
          <ContributionNextSteps steps={steps} />
        )}
      </div>
      {alternatives.length ? (
        <nav
          aria-label={alternativesTitle}
          className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7"
          style={{ borderColor: T.border.line }}
        >
          <h3 className="type-small-heading m-0 mb-3">{alternativesTitle}</h3>
          <ul className="m-0 list-none p-0">
            {alternatives.slice(0, 3).map((item, index) => (
              <li
                key={item.href}
                className={
                  index < Math.min(alternatives.length, 3) - 1 ? "border-b" : ""
                }
                style={{ borderColor: T.border.line }}
              >
                <GlobalLink
                  className="flex min-h-11 flex-col gap-0.5 py-2.5 no-underline hover:underline"
                  href={item.href}
                  style={{ color: T.ink.base }}
                >
                  <span className="text-base font-semibold">{item.title}</span>
                  {item.description ? (
                    <span
                      className="text-sm leading-[1.5] font-normal"
                      style={{ color: T.ink.dim }}
                    >
                      {item.description}
                    </span>
                  ) : null}
                </GlobalLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  )
}
