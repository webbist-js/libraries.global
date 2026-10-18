import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb"

/**
 * The one hero band for primary section pages (Find libraries, Journal,
 * Events, Knowledge, Contribute) and their search/sub pages. Tinted paper band with
 * a hairline rule below; eyebrow pill + serif title on the left, lead +
 * optional slot (search, status) on the right. Don't hand-roll a hero — add a
 * prop here instead so every section stays in step.
 *
 * `title` accepts `*italic*` markup, rendered as indigo italic.
 * `tabs` takes a `SectionTabs` row for sections with sub-pages.
 * `chips` adds pills after the eyebrow pill (a type tint, a status);
 * `meta` is one line under the title (operator, links, a plan chip).
 */
export function PageHero({
  breadcrumb,
  eyebrow,
  eyebrowIcon,
  eyebrowAccent,
  chips,
  title,
  meta,
  lead,
  compact = false,
  plainTitle = false,
  tabs,
  back,
  children,
  leadPlacement = "right",
  actions,
  staff = false,
  displayTitle = false,
  prelude,
  footer,
  emphasisTone = "brand",
}: {
  /** Optional breadcrumb trail rendered above the eyebrow pill. */
  readonly breadcrumb?: BreadcrumbItem[]
  /** The eyebrow pill's label. Omit it (and `back`) to skip the pill row. */
  readonly eyebrow?: ReactNode
  /**
   * Pills rendered in the same row as the eyebrow pill, after it: a
   * library-type tint, a status. Each chip styles itself.
   */
  readonly chips?: ReactNode
  /** Iconify id, e.g. "mdi:book-open-outline". */
  readonly eyebrowIcon?: string
  /** Trailing indigo text inside the pill, e.g. a version number. */
  readonly eyebrowAccent?: ReactNode
  readonly title: string
  /**
   * Render `title` as plain text, asterisks included: for user-supplied
   * titles that mustn't be read as `*italic*` markup.
   */
  readonly plainTitle?: boolean
  /** One line under the title: operator, "View public page", a plan chip. */
  readonly meta?: ReactNode
  readonly lead?: ReactNode
  /** Tighter band + smaller title for task pages (forms, wizards). */
  readonly compact?: boolean
  /** Rendered under the lead in the right column (search field, status line). */
  readonly children?: ReactNode
  /** Put the lead and actions below the title, leaving the right slot for stats. */
  readonly leadPlacement?: "left" | "right"
  readonly actions?: ReactNode
  /** Wider title column and display type for a library's staff workspace. */
  readonly staff?: boolean
  /** Larger editorial display type, independent of the lead column position. */
  readonly displayTitle?: boolean
  /** Full-width metadata above the title columns. */
  readonly prelude?: ReactNode
  /** Full-width summary below the title columns, above section tabs. */
  readonly footer?: ReactNode
  readonly emphasisTone?: "brand" | "ink"
  /**
   * Section tabs (`SectionTabs`) on the band's bottom edge, for sections
   * with sub-pages (Contribute, Knowledge).
   */
  readonly tabs?: ReactNode
  /**
   * A back link ("‹ Contribute") in place of the eyebrow pill, for task
   * pages reached from a section's landing page.
   */
  readonly back?: { href: string; label: string }
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
          staff
            ? "grid gap-x-12 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-end"
            : leadPlacement === "left"
              ? "grid gap-x-16 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-end"
              : "grid gap-x-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end",
          compact ? "gap-y-5" : "gap-y-8",
          leadPlacement === "left" && breadcrumb?.length
            ? "pt-3 pb-12 sm:pb-16"
            : bandPadding({
                breadcrumb: Boolean(breadcrumb?.length),
                compact,
                tabs: Boolean(tabs),
              }),
        ].join(" ")}
      >
        {prelude ? <div className="-mb-4 lg:col-span-2">{prelude}</div> : null}
        <div>
          {back || eyebrow || chips ? (
            <div
              className={[
                "flex flex-wrap items-center gap-2",
                compact || staff ? "mb-3" : "mb-5",
              ].join(" ")}
            >
              {back ? (
                <Link
                  href={back.href}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border py-1 pr-3 pl-2 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.line,
                    color: T.ink.base,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    height={16}
                    icon="mdi:chevron-left"
                    width={16}
                    style={{ color: T.ink.dim }}
                  />
                  {back.label}
                </Link>
              ) : eyebrow ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold ${staff ? "py-1.5" : "py-1"}`}
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
                    <span style={{ color: T.accent.primary }}>
                      {eyebrowAccent}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {chips}
            </div>
          ) : null}
          <h1
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontSize: displayTitle
                ? "clamp(48px,6.5vw,88px)"
                : staff
                  ? "clamp(40px,5.8vw,80px)"
                  : compact
                    ? "clamp(32px,3.6vw,46px)"
                    : leadPlacement === "left"
                      ? "clamp(48px,6.5vw,88px)"
                      : "clamp(40px,5vw,68px)",
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              whiteSpace: "pre-line",
            }}
          >
            {plainTitle ? title : parseHeroText(title, emphasisTone)}
          </h1>
          {meta ? (
            <div
              className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 ${staff ? "text-[17px]" : "text-[15px]"}`}
              style={{ color: T.ink.dim }}
            >
              {meta}
            </div>
          ) : null}
          {leadPlacement === "left" && lead ? (
            <p
              className="mt-6 mb-0 max-w-[56ch] text-[17px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {lead}
            </p>
          ) : null}
          {actions ? <div className="mt-6">{actions}</div> : null}
        </div>

        {(leadPlacement === "right" && lead) || children ? (
          <div className="flex flex-col gap-5">
            {leadPlacement === "right" && lead ? (
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
        {footer ? <div className="lg:col-span-2">{footer}</div> : null}
      </Container>
      {tabs ? <Container>{tabs}</Container> : null}
    </section>
  )
}

/** Band padding: tighter under a breadcrumb, and above a row of tabs. */
function bandPadding({
  breadcrumb,
  compact,
  tabs,
}: {
  breadcrumb: boolean
  compact: boolean
  tabs: boolean
}): string {
  const top = compact
    ? breadcrumb
      ? "pt-5"
      : "pt-[clamp(28px,4vw,44px)]"
    : breadcrumb
      ? "pt-[clamp(24px,3.5vw,40px)]"
      : "pt-[clamp(40px,6vw,72px)]"
  const bottom = compact
    ? tabs
      ? "pb-6"
      : "pb-[clamp(28px,4vw,44px)]"
    : tabs
      ? "pb-[clamp(28px,4vw,48px)]"
      : "pb-[clamp(40px,6vw,72px)]"

  return `${top} ${bottom}`
}

/**
 * Parse a hero title string that uses *word* markup for italic spans; every
 * span renders as an indigo italic em (the homepage hero's emphasis).
 *
 * Example: "Field notes *from the stacks.*"
 */
export function parseHeroText(
  text: string,
  emphasisTone: "brand" | "ink" = "brand"
): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)

  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em
          key={i}
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            color: emphasisTone === "ink" ? T.ink.base : T.accent.primary,
          }}
        >
          {part.slice(1, -1)}
        </em>
      )
    }

    return <span key={i}>{part}</span>
  })
}
