import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"

import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb"

/**
 * The one hero band for primary section pages (Find libraries, Journal,
 * Events, Docs, Contribute) and their search/sub pages. Tinted paper band with
 * a hairline rule below; eyebrow pill + serif title on the left, lead +
 * optional slot (search, status) on the right. Don't hand-roll a hero — add a
 * prop here instead so every section stays in step.
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
  compact = false,
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
  /** Tighter band + smaller title for task pages (forms, wizards). */
  readonly compact?: boolean
  /** Rendered under the lead in the right column (search field, status line). */
  readonly children?: ReactNode
}) {
  return (
    <section
      className="border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      {breadcrumb?.length ? (
        <Container className={compact ? "pt-5 sm:pt-7" : "pt-6 sm:pt-10"}>
          <Breadcrumb items={breadcrumb} />
        </Container>
      ) : null}
      <Container
        className={[
          "grid gap-x-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end",
          compact ? "gap-y-5" : "gap-y-8",
          breadcrumb?.length
            ? compact
              ? "pt-5 pb-[clamp(28px,4vw,44px)]"
              : "pt-[clamp(24px,3.5vw,40px)] pb-[clamp(40px,6vw,72px)]"
            : compact
              ? "py-[clamp(28px,4vw,44px)]"
              : "py-[clamp(40px,6vw,72px)]",
        ].join(" ")}
      >
        <div>
          <p className={compact ? "m-0 mb-4" : "m-0 mb-5"}>
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
              fontSize: compact
                ? "clamp(32px,3.6vw,46px)"
                : "clamp(40px,5vw,68px)",
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

/**
 * Parse a hero title string that uses *word* markup for italic spans; every
 * span renders as an indigo italic em (the homepage hero's emphasis).
 *
 * Example: "Field notes *from the stacks.*"
 */
export function parseHeroText(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)

  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em
          key={i}
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            color: T.accent.primary,
          }}
        >
          {part.slice(1, -1)}
        </em>
      )
    }

    return <span key={i}>{part}</span>
  })
}
