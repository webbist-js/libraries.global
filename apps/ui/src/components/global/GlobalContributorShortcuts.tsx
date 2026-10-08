"use client"

import { Icon } from "@iconify/react"
import { useId } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  type ContributeMenu,
  useContributeMenu,
} from "@/hooks/useContributeMenu"
import type {
  ContributorCard,
  ContributorLink,
} from "@/lib/contributor-shortcuts"
import { T } from "@/lib/design-tokens"

import {
  CardMonogram,
  CountPill,
  LibrarySelect,
  PlanPill,
} from "./ContributeMenuParts"

/** The footer carries the editor cards only. */
const FOOTER_CARDS = new Set<ContributorCard["key"]>(["knowledge", "journal"])

function MobileLink({ link }: { readonly link: ContributorLink }) {
  return (
    <GlobalLink
      href={link.href}
      className="flex min-h-11 items-center justify-between gap-2 border-t px-1 text-[15px] font-semibold text-(--t-ink-base) no-underline"
      style={{ borderColor: T.border.divider }}
    >
      <span className="min-w-0 truncate">{link.label}</span>
      {link.badge ? <CountPill count={link.badge} what="waiting" /> : null}
    </GlobalLink>
  )
}

/** One card as an accordion: monogram, title, how many links, the links. */
function MobileTile({
  card,
  open,
  library,
}: {
  readonly card: ContributorCard
  readonly open: boolean
  readonly library: ContributeMenu["library"]
}) {
  const featured =
    card.featured && card.featured !== "loading" ? card.featured : null
  const count = card.links.length + (featured ? 1 : 0)

  return (
    <details
      open={open}
      className="group rounded-[16px] border px-3"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
        <CardMonogram icon={card.icon} tint={card.tint} size={30} />
        <span
          className="flex-1 text-[16px] font-bold"
          style={{ color: T.ink.base }}
        >
          {card.title}
        </span>
        <span className="text-[13px]" style={{ color: T.ink.dim }}>
          {count}
          <span className="sr-only"> {count === 1 ? "link" : "links"}</span>
        </span>
        <Icon
          icon="mdi:chevron-down"
          width={18}
          height={18}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
          style={{ color: T.ink.faint }}
        />
      </summary>
      {card.key === "libraries" && library.options.length > 1 ? (
        <div className="pb-2">
          <LibrarySelect library={library} />
        </div>
      ) : null}
      <ul className="m-0 mb-2 list-none p-0">
        {featured ? (
          <li>
            <MobileLink link={{ label: featured.title, href: featured.href }} />
          </li>
        ) : null}
        {card.links.map((link) => (
          <li key={`${link.href}:${link.label}`}>
            <MobileLink link={link} />
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * The mobile menu's Contribute section: the same cards as the header
 * panel, one accordion each with the first open, then the Membership row.
 */
function MobileShortcuts() {
  const menu = useContributeMenu(true)
  const titleId = useId()
  const cards = [...menu.work, ...menu.common]

  return (
    <section
      aria-labelledby={titleId}
      className="-mx-4 mt-3 flex flex-col gap-2 border-t px-3 pt-3 pb-4 sm:-mx-8 sm:px-7"
      style={{ background: T.bg.muted, borderColor: T.border.line }}
    >
      <h2
        id={titleId}
        className="m-0 mx-1 text-[24px] font-medium"
        style={{ fontFamily: T.font.serif, color: T.ink.base }}
      >
        Contribute
      </h2>
      {menu.status === "signedOut" ? (
        <GlobalLink
          href="/auth/signin"
          className="mx-1 mb-1 self-start rounded-full bg-(--t-accent-primary) px-4 py-2.5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
        >
          Sign in to contribute
        </GlobalLink>
      ) : null}
      {menu.status === "loading" ? (
        <p
          role="status"
          aria-busy="true"
          className="m-0 mx-1 text-[14px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          Loading your shortcuts…
        </p>
      ) : null}
      {cards.map((card, index) => (
        <MobileTile
          key={card.key}
          card={card}
          open={index === 0}
          library={menu.library}
        />
      ))}
      <GlobalLink
        href="/contribute/membership"
        className="flex min-h-[52px] items-center gap-2.5 rounded-[16px] border px-3 text-[16px] font-bold text-(--t-ink-base) no-underline"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        Membership
        {menu.plan ? (
          <span className="ml-auto">
            <PlanPill plan={menu.plan} />
          </span>
        ) : null}
      </GlobalLink>
    </section>
  )
}

/** The footer's editor pills: Knowledge and Journal, for editors only. */
function FooterShortcuts() {
  const menu = useContributeMenu(false)
  const baseId = useId()
  const cards = menu.work.filter((card) => FOOTER_CARDS.has(card.key))
  if (cards.length === 0) return null

  return (
    <div
      className="flex flex-col gap-8 border-t pt-8 md:flex-row"
      style={{ borderColor: T.border.line }}
    >
      {cards.map((card) => {
        const titleId = `${baseId}-${card.key}`

        return (
          <nav
            key={card.key}
            aria-labelledby={titleId}
            className="flex flex-col gap-4 md:flex-1"
          >
            <p
              id={titleId}
              className="m-0 text-[18px] font-bold"
              style={{ color: T.ink.dim }}
            >
              {card.title}
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {card.links.map((link) => (
                <li key={`${link.href}:${link.label}`}>
                  <GlobalLink
                    href={link.href}
                    className="inline-flex items-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-3.5 py-2 text-[15px] font-medium text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary)"
                  >
                    {link.label}
                  </GlobalLink>
                </li>
              ))}
            </ul>
          </nav>
        )
      })}
    </div>
  )
}

/**
 * The Contribute cards outside the header panel: a section in the mobile
 * menu, or a row of editor pills under the footer's link columns (nothing
 * when the viewer holds no editor role).
 */
export function GlobalContributorShortcuts({
  variant,
}: {
  readonly variant: "mobile" | "footer"
}) {
  return variant === "mobile" ? <MobileShortcuts /> : <FooterShortcuts />
}

GlobalContributorShortcuts.displayName = "GlobalContributorShortcuts"

export default GlobalContributorShortcuts
