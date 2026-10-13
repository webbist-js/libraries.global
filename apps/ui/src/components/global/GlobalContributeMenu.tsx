"use client"

import { Icon } from "@iconify/react"
import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

const PILL =
  "min-h-11 rounded-full border-0 bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"

const GROUP_LABEL = "m-0 mx-1 text-[13px] font-bold"

function Chevron() {
  return (
    <Icon
      icon="mdi:chevron-right"
      width={16}
      height={16}
      aria-hidden="true"
      className="shrink-0"
      style={{ color: T.ink.faint }}
    />
  )
}

function CardLink({
  link,
  onNavigate,
}: {
  readonly link: ContributorLink
  readonly onNavigate: () => void
}) {
  return (
    <GlobalLink
      href={link.href}
      onClick={onNavigate}
      className="flex min-h-10 items-center gap-2 rounded-[10px] px-2 py-1.5 text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-accent-chip) hover:text-(--t-accent-primary-hover)"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{link.label}</span>
        {link.sub ? (
          <span className="truncate text-[13px]" style={{ color: T.ink.dim }}>
            {link.sub}
          </span>
        ) : null}
      </span>
      {link.badge ? <CountPill count={link.badge} what="waiting" /> : null}
      <Chevron />
    </GlobalLink>
  )
}

/** The Drives card's featured drive: a placeholder until it has loaded. */
function FeaturedDrive({
  featured,
  onNavigate,
}: {
  readonly featured: NonNullable<ContributorCard["featured"]>
  readonly onNavigate: () => void
}) {
  const tUi = useUiTranslations("ui")

  if (featured === "loading") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={tUi("loading_featured_drive")}
        className="flex flex-col gap-1.5 rounded-[12px] border px-3 py-2.5"
        style={{ background: T.bg.surface, borderColor: T.border.divider }}
      >
        <span
          className="h-2.5 w-2/5 animate-pulse rounded"
          style={{ background: T.bg.muted2 }}
        />
        <span
          className="h-3.5 w-5/6 animate-pulse rounded"
          style={{ background: T.bg.muted2 }}
        />
        <span
          className="h-1.5 rounded-full"
          style={{ background: T.bg.muted2 }}
        />
      </div>
    )
  }

  return (
    <GlobalLink
      href={featured.href}
      onClick={onNavigate}
      className="flex flex-col gap-1.5 rounded-[12px] border border-transparent px-3 py-2.5 text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary)"
      style={{ background: T.accent.chip }}
    >
      <span
        className="text-[12px] font-bold"
        style={{ color: T.accent.primaryHover }}
      >
        Featured drive
      </span>
      <span
        className="line-clamp-2 text-[18px] leading-tight"
        style={{ fontFamily: T.font.serif }}
      >
        {featured.title}
      </span>
      {featured.progress ? (
        <>
          {/* Decorative: the line under it says the same. */}
          <span
            aria-hidden="true"
            className="block h-1.5 overflow-hidden rounded-full"
            style={{ background: T.bg.deep }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${featured.percent}%`,
                background: T.accent.primary,
              }}
            />
          </span>
          <span className="text-[13px]" style={{ color: T.ink.dim }}>
            {featured.progress}
          </span>
        </>
      ) : null}
    </GlobalLink>
  )
}

function Card({
  card,
  span,
  library,
  onNavigate,
}: {
  readonly card: ContributorCard
  /** The odd card out takes the whole row. */
  readonly span: boolean
  readonly library: ContributeMenu["library"]
  readonly onNavigate: () => void
}) {
  const titleId = useId()

  return (
    <li
      className={`flex min-w-0 flex-col gap-2 rounded-[18px] border p-3 ${span ? "col-span-full" : ""}`}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex items-start gap-2.5 px-1 pt-0.5">
        <CardMonogram icon={card.icon} tint={card.tint} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <p
            id={titleId}
            className="m-0 text-[16px] leading-tight font-bold"
            style={{ color: T.ink.base }}
          >
            {card.title}
          </p>
          <p
            className="m-0 text-[13px] leading-snug"
            style={{ color: T.ink.dim }}
          >
            {card.description}
          </p>
        </div>
      </div>
      {card.key === "libraries" && library.options.length > 1 ? (
        <LibrarySelect library={library} />
      ) : null}
      {card.featured ? (
        <FeaturedDrive featured={card.featured} onNavigate={onNavigate} />
      ) : null}
      <ul aria-labelledby={titleId} className="m-0 flex list-none flex-col p-0">
        {card.links.map((link) => (
          <li key={`${link.href}:${link.label}`}>
            <CardLink link={link} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </li>
  )
}

function CardGrid({
  cards,
  library,
  onNavigate,
}: {
  readonly cards: ContributorCard[]
  readonly library: ContributeMenu["library"]
  readonly onNavigate: () => void
}) {
  const odd = cards.length % 2 === 1

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
      {cards.map((card, index) => (
        <Card
          key={card.key}
          card={card}
          span={odd && index === cards.length - 1}
          library={library}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  )
}

function SignInCard({ onNavigate }: { readonly onNavigate: () => void }) {
  const tUi = useUiTranslations("ui")

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[18px] border px-4 py-3.5"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <p
        className="m-0 flex-1 basis-[260px] text-[15px] leading-normal"
        style={{ color: T.ink.base }}
      >
        <strong>{tUi("contributing_is_free")}</strong>{" "}
        {tUi("sign_in_to_suggest_edits_add_libraries_and_join_drives")}{" "}
      </p>
      <span className="flex gap-1.5">
        <GlobalLink
          href="/auth/signin"
          onClick={onNavigate}
          className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
        >
          {tUi("sign_in")}{" "}
        </GlobalLink>
        <GlobalLink
          href="/auth/register"
          onClick={onNavigate}
          className="rounded-full border border-(--t-border-hi) bg-white px-3.5 py-2 text-[14px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary)"
        >
          {tUi("create_account")}{" "}
        </GlobalLink>
      </span>
    </div>
  )
}

function LoadingRow() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center gap-3 rounded-[18px] border border-dashed px-4 py-3"
      style={{ borderColor: T.border.hi }}
    >
      <span
        aria-hidden="true"
        className="size-[30px] shrink-0 animate-pulse rounded-full"
        style={{ background: T.bg.muted2 }}
      />
      <span className="flex flex-1 flex-col gap-1.5">
        <span
          className="text-[14px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          Loading your shortcuts…
        </span>
        <span
          aria-hidden="true"
          className="h-2 w-3/5 animate-pulse rounded"
          style={{ background: T.bg.muted2 }}
        />
      </span>
    </div>
  )
}

function MembershipRow({
  plan,
  onNavigate,
}: {
  readonly plan: ContributeMenu["plan"]
  readonly onNavigate: () => void
}) {
  const tUi = useUiTranslations("ui")

  return (
    <GlobalLink
      href="/contribute/membership"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-[16px] border border-(--t-border-line) px-3.5 py-2.5 text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary)"
      style={{ background: T.bg.deep }}
    >
      <CardMonogram icon="mdi:heart-outline" tint="accent" />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-[15px]">{tUi("membership")}</strong>
        <span className="text-[13px]" style={{ color: T.ink.dim }}>
          {tUi("support_the_index_and_explore_pro")}{" "}
        </span>
      </span>
      {plan ? <PlanPill plan={plan} /> : null}
      <Chevron />
    </GlobalLink>
  )
}

/**
 * The panel's contents: a sign-in card or a loading row, "Your work" (the
 * viewer's own cards, when any), "Everyone" (Drives and Contribute) and
 * the Membership row. Shared by the header popover; the mobile menu lays
 * the same cards out as accordions.
 */
export function ContributeMenuPanel({
  menu,
  onNavigate,
}: {
  readonly menu: ContributeMenu
  readonly onNavigate: () => void
}) {
  const tUi = useUiTranslations("ui")

  const workId = useId()
  const everyoneId = useId()
  const hasWork = menu.work.length > 0

  return (
    <nav aria-label={tUi("contribute_menu")} className="flex flex-col gap-3">
      {menu.status === "signedOut" ? (
        <SignInCard onNavigate={onNavigate} />
      ) : null}
      {menu.status === "loading" ? <LoadingRow /> : null}

      {hasWork ? (
        <div
          role="group"
          aria-labelledby={workId}
          className="flex flex-col gap-2"
        >
          <p id={workId} className={GROUP_LABEL} style={{ color: T.ink.dim }}>
            {tUi("your_work")}{" "}
          </p>
          <CardGrid
            cards={menu.work}
            library={menu.library}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}

      <div
        role="group"
        aria-labelledby={everyoneId}
        className="flex flex-col gap-2"
      >
        <p
          id={everyoneId}
          className={hasWork ? GROUP_LABEL : "sr-only"}
          style={{ color: T.ink.dim }}
        >
          {tUi("everyone")}{" "}
        </p>
        <CardGrid
          cards={menu.common}
          library={menu.library}
          onNavigate={onNavigate}
        />
      </div>

      <MembershipRow plan={menu.plan} onNavigate={onNavigate} />
    </nav>
  )
}

/**
 * The header's primary action: a Contribute button that opens a 640px
 * panel of small cards, one per kind of work the viewer can do. Open for
 * everyone, signed out included; the cards combine for people with several
 * roles. Escape closes it and returns focus to the button.
 */
export function GlobalContributeMenu({
  className = "",
}: {
  readonly className?: string
}) {
  const tUi = useUiTranslations("ui")

  const pathname = usePathname() ?? "/"
  // Open "for" the page it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null)
  const contentRef = useRef<HTMLDivElement>(null)
  const menu = useContributeMenu(open)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex cursor-pointer items-center gap-1 ${PILL} pr-3 ${className}`}
        >
          {tUi("contribute")}{" "}
          <Icon
            icon="mdi:chevron-down"
            width={18}
            height={18}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        ref={contentRef}
        align="end"
        sideOffset={20}
        collisionPadding={16}
        onOpenAutoFocus={(event) => {
          // Land on the first link rather than on the panel itself.
          const first =
            contentRef.current?.querySelector<HTMLElement>("a, button, select")
          if (first) {
            event.preventDefault()
            first.focus()
          }
        }}
        className="max-h-(--radix-popover-content-available-height) w-[640px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[24px] border p-3 shadow-[0_12px_28px_rgba(23,22,43,.08)]"
        style={{ background: T.bg.surface, borderColor: T.border.hi }}
      >
        <ContributeMenuPanel menu={menu} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

GlobalContributeMenu.displayName = "GlobalContributeMenu"

export default GlobalContributeMenu
