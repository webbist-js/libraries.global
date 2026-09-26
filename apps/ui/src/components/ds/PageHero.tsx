import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"

import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb"
import { parseHeroText } from "./HeroTitle"

/**
 * Canonical v2 hero band for top-level section landings (Docs, Journal,
 * Events). Tinted paper band with a hairline rule below; eyebrow pill +
 * serif title on the left, lead + optional slot (search, status) on the right.
 *
 * `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function PageHero({
  breadcrumb,
  eyebrow,
  eyebrowIcon,
  eyebrowAccent,
  title,
  lead,
  children,
}: {
  /** Optional breadcrumb trail rendered above the eyebrow pill. */
  readonly breadcrumb?: BreadcrumbItem[]
  readonly eyebrow: ReactNode
  /** Iconify id, e.g. "mdi:book-open-outline". */
  readonly eyebrowIcon?: string
  /** Trailing indigo text inside the pill, e.g. a version number. */
  readonly eyebrowAccent?: ReactNode
  readonly title: string
  readonly lead?: ReactNode
  /** Rendered under the lead in the right column (search field, status line). */
  readonly children?: ReactNode
}) {
  return (
    <section
      className="border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      {breadcrumb?.length ? (
        <Container className="pt-6 sm:pt-10">
          <Breadcrumb items={breadcrumb} />
        </Container>
      ) : null}
      <Container
        className={
          breadcrumb?.length
            ? "grid gap-x-16 gap-y-8 pt-[clamp(24px,3.5vw,40px)] pb-[clamp(40px,6vw,72px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end"
            : "grid gap-x-16 gap-y-8 py-[clamp(40px,6vw,72px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end"
        }
      >
        <div>
          <p className="m-0 mb-5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold"
              style={{
                background: T.bg.deep,
                borderColor: T.border.line,
                color: T.ink.base,
              }}
            >
              {eyebrowIcon ? (
                <Icon
                  aria-hidden="true"
                  height={15}
                  icon={eyebrowIcon}
                  style={{ color: T.accent.primary }}
                  width={15}
                />
              ) : null}
              {eyebrow}
              {eyebrowAccent ? (
                <span style={{ color: T.accent.primary }}>{eyebrowAccent}</span>
              ) : null}
            </span>
          </p>
          <h1
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(40px,5vw,68px)",
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: T.ink.base,
            }}
          >
            {parseHeroText(title)}
          </h1>
        </div>

        {lead || children ? (
          <div className="flex flex-col gap-5">
            {lead ? (
              <p
                className="m-0 max-w-[52ch] text-[17px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                {lead}
              </p>
            ) : null}
            {children}
          </div>
        ) : null}
      </Container>
    </section>
  )
}

/** Shared visual for hero search fields so every section's search box matches. */
