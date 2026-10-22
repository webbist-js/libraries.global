"use client"

import { Icon } from "@iconify/react"
import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  HeaderDropdownContent,
  HeaderDropdownTrigger,
} from "@/components/global/HeaderDropdown"
import { Popover } from "@/components/ui/popover"
import {
  type ContributeMenu,
  useContributeMenu,
} from "@/hooks/useContributeMenu"
import type {
  ContributorCard,
  ContributorLink,
} from "@/lib/contributor-shortcuts"

import {
  CardMonogram,
  CountPill,
  LibrarySelect,
  PlanPill,
} from "./ContributeMenuParts"

const PILL =
  "min-h-11 rounded-full border-0 bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"

function Chevron() {
  return (
    <Icon
      icon="mdi:chevron-right"
      width={15}
      height={15}
      aria-hidden
      className="shrink-0 text-(--t-ink-low)"
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
      className={`flex min-h-11 items-center gap-2 rounded-[12px] px-2 py-2 text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) ${FOCUS}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] leading-snug font-semibold">
          {link.label}
        </span>
        {link.sub ? (
          <span className="mt-0.5 text-[14px] leading-snug text-(--t-ink-dim)">
            {link.sub}
          </span>
        ) : null}
      </span>
      {link.badge ? <CountPill count={link.badge} what="waiting" /> : null}
      <Chevron />
    </GlobalLink>
  )
}

/** A compact drive preview; its published progress remains the source of truth. */
function FeaturedDrive({
  featured,
  onNavigate,
}: {
  readonly featured: NonNullable<ContributorCard["featured"]>
  readonly onNavigate: () => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("contributeMenu")
  if (featured === "loading")
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={tUi("loading_featured_drive")}
        className="flex flex-col gap-2 rounded-[16px] bg-(--t-accent-chip)/50 px-3.5 py-3"
      >
        <span
          aria-hidden
          className="h-2.5 w-2/5 animate-pulse rounded bg-(--t-border-hi) motion-reduce:animate-none"
        />
        <span
          aria-hidden
          className="h-4 w-5/6 animate-pulse rounded bg-(--t-border-hi) motion-reduce:animate-none"
        />
        <span aria-hidden className="h-1.5 rounded-full bg-white" />
      </div>
    )

  return (
    <GlobalLink
      href={featured.href}
      onClick={onNavigate}
      className={`flex flex-col gap-2 rounded-[16px] border border-(--t-edge-info) bg-(--t-bg-selected) px-3.5 py-3 text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary) ${FOCUS}`}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-bold tracking-wide text-(--t-accent-primary) uppercase">
        <Icon aria-hidden icon="mdi:pin-outline" width={13} height={13} />
        {t("featuredDrive")}
      </span>
      <span className="font-serif text-[21px] leading-[1.1] tracking-[-0.015em]">
        {featured.title}
      </span>
      {featured.progress ? (
        <>
          <span
            aria-hidden
            className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-white"
          >
            <span
              className="block h-full rounded-full bg-(--t-accent-primary)"
              style={{ width: `${featured.percent}%` }}
            />
          </span>
          <span className="text-[14px] leading-snug text-(--t-ink-dim)">
            {featured.progress}
          </span>
        </>
      ) : null}
    </GlobalLink>
  )
}

/** Review's main entry point and the board's additional review queues. */
function ReviewShortcut({
  card,
  onNavigate,
}: {
  readonly card: ContributorCard
  readonly onNavigate: () => void
}) {
  const t = useUiTranslations("contributeMenu")
  const link = card.links[0]
  if (!link) return null

  return (
    <div className="grid gap-2">
      <GlobalLink
        href={link.href}
        onClick={onNavigate}
        className={`flex min-h-[76px] items-center gap-3 rounded-[18px] bg-[#19172c] px-4 py-3 text-white no-underline transition-colors hover:bg-[#29253f] ${FOCUS}`}
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#c5bdf8]"
        >
          <Icon icon="mdi:shield-check-outline" width={21} height={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{link.label}</span>
          <span className="mt-0.5 block text-[14px] leading-relaxed text-[#d1cedd]">
            {link.sub ?? t("reviewLead")}
          </span>
        </span>
        {link.badge ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[14px] font-semibold tabular-nums">
            {link.badge} <span>{t("waiting")}</span>
          </span>
        ) : null}
        <Icon
          aria-hidden
          icon="mdi:arrow-right"
          width={17}
          height={17}
          className="shrink-0 text-[#d1cedd]"
        />
      </GlobalLink>
      {card.links.slice(1).map((item) => (
        <CardLink key={item.href} link={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function Card({
  card,
  library,
  onNavigate,
  hideHeading = false,
  columns = false,
  groupHeadingId,
}: {
  readonly card: ContributorCard
  readonly library: ContributeMenu["library"]
  readonly onNavigate: () => void
  readonly hideHeading?: boolean
  readonly groupHeadingId: string
  readonly columns?: boolean
}) {
  const titleId = useId()
  const publishing = card.key === "knowledge" || card.key === "journal"
  const compactActions = publishing || card.key === "team"
  const hasHeading = !hideHeading && card.key !== "hub"
  // The hub is always available in the panel header.
  const links = card.links.filter((link) => link.href !== "/contribute")

  return (
    <li
      className={`flex min-w-0 flex-col gap-2.5 ${columns ? "rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-3" : "py-3 first:pt-0 last:pb-0"}`}
    >
      {hasHeading ? (
        <div className="flex items-center gap-3 px-1">
          <CardMonogram icon={card.icon} tint={card.tint} size={30} />
          <div className="min-w-0 flex-1">
            <h4
              id={titleId}
              className="m-0 text-[14px] leading-6 font-bold text-(--t-ink-base)"
            >
              {card.title}
            </h4>
            <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-(--t-ink-dim)">
              {card.description}
            </p>
          </div>
        </div>
      ) : null}
      {hideHeading && card.key !== "hub" ? (
        <p className="m-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
          {card.description}
        </p>
      ) : null}
      {card.key === "libraries" && library.options.length > 1 ? (
        <LibrarySelect library={library} />
      ) : null}
      <div
        className={
          card.key === "drives" && card.featured
            ? "grid items-center gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
            : undefined
        }
      >
        {card.featured ? (
          <FeaturedDrive featured={card.featured} onNavigate={onNavigate} />
        ) : null}
        <ul
          aria-labelledby={hasHeading ? titleId : groupHeadingId}
          className={
            compactActions
              ? "m-0 flex list-none flex-wrap gap-2 p-0"
              : card.key === "hub"
                ? "m-0 grid list-none gap-1 p-0 sm:grid-cols-2"
                : "m-0 flex list-none flex-col p-0"
          }
        >
          {links.map((link) => (
            <li key={`${link.href}:${link.label}`}>
              {compactActions ? (
                <GlobalLink
                  href={link.href}
                  onClick={onNavigate}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-3 text-[14px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) ${FOCUS}`}
                >
                  <Icon
                    aria-hidden
                    icon={
                      card.key === "team"
                        ? link.href.endsWith("/api")
                          ? "mdi:code-tags"
                          : link.href.endsWith("/billing")
                            ? "mdi:credit-card-outline"
                            : "mdi:account-group-outline"
                        : link.href.includes("/new")
                          ? "mdi:plus"
                          : "mdi:pencil-outline"
                    }
                    width={14}
                    height={14}
                  />
                  {link.label}
                </GlobalLink>
              ) : (
                <CardLink link={link} onNavigate={onNavigate} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

function CardGroup({
  title,
  cards,
  library,
  onNavigate,
  columns = false,
}: {
  readonly title: string
  readonly cards: ContributorCard[]
  readonly columns?: boolean
  readonly library: ContributeMenu["library"]
  readonly onNavigate: () => void
}) {
  const titleId = useId()

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="min-w-0 rounded-[20px] border border-(--t-border-line) bg-white p-3.5"
    >
      <h3
        id={titleId}
        className="m-0 mb-4 font-serif text-[23px] leading-tight tracking-[-0.02em] text-(--t-ink-base)"
      >
        {title}
      </h3>
      <ul
        className={
          columns
            ? "m-0 grid list-none gap-4 p-0 sm:grid-cols-2"
            : "m-0 list-none divide-y divide-(--t-divider) p-0"
        }
      >
        {cards.map((card) => (
          <Card
            key={card.key}
            card={card}
            library={library}
            onNavigate={onNavigate}
            hideHeading={cards.length === 1 && card.title === title}
            columns={columns}
            groupHeadingId={titleId}
          />
        ))}
      </ul>
    </div>
  )
}

function SignInCard({ onNavigate }: { readonly onNavigate: () => void }) {
  const tUi = useUiTranslations("ui")

  return (
    <div className="rounded-[18px] border border-(--t-edge-info) bg-(--t-bg-selected) px-4 py-3.5">
      <p className="m-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
        <strong className="text-(--t-ink-base)">
          {tUi("contributing_is_free")}
        </strong>{" "}
        {tUi("sign_in_to_suggest_edits_add_libraries_and_join_drives")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <GlobalLink
          href="/auth/signin"
          onClick={onNavigate}
          className={`inline-flex min-h-10 items-center rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover) ${FOCUS}`}
        >
          {tUi("sign_in")}
        </GlobalLink>
        <GlobalLink
          href="/auth/register"
          onClick={onNavigate}
          className={`inline-flex min-h-10 items-center rounded-full border border-(--t-border-hi) bg-white px-4 text-[14px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) ${FOCUS}`}
        >
          {tUi("create_account")}
        </GlobalLink>
      </div>
    </div>
  )
}

function LoadingRow() {
  const t = useUiTranslations("contributeMenu")

  return (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center gap-3 rounded-[18px] border border-dashed border-(--t-border-hi) px-4 py-3"
    >
      <span
        aria-hidden
        className="size-8 shrink-0 animate-pulse rounded-full bg-(--t-bg-muted-2) motion-reduce:animate-none"
      />
      <span className="flex flex-1 flex-col gap-2">
        <span className="text-[13px] font-semibold text-(--t-ink-dim)">
          {t("loading")}
        </span>
        <span
          aria-hidden
          className="h-2 w-3/5 animate-pulse rounded bg-(--t-bg-muted-2) motion-reduce:animate-none"
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
      className={`flex min-h-16 items-center gap-3 border-t border-(--t-border-line) bg-white px-5 py-3 text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) ${FOCUS}`}
    >
      <CardMonogram icon="mdi:heart-outline" tint="accent" size={30} />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-[14px]">{tUi("membership")}</strong>
        <span className="mt-0.5 text-[14px] leading-snug text-(--t-ink-dim)">
          {tUi("support_the_index_and_explore_pro")}
        </span>
      </span>
      {plan ? <PlanPill plan={plan} /> : null}
      <Chevron />
    </GlobalLink>
  )
}

/** Capability-based shortcuts, with review separated from everyday contribution. */
export function ContributeMenuPanel({
  menu,
  onNavigate,
}: {
  readonly menu: ContributeMenu
  readonly onNavigate: () => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("contributeMenu")
  const tools = menu.work.filter((card) => card.key !== "review")
  const review = menu.work.find((card) => card.key === "review")
  const hub = menu.common.find((card) => card.key === "hub")
  const drives = menu.common.find((card) => card.key === "drives")
  const hubLink = hub?.links.find((link) => link.href === "/contribute")

  return (
    <nav aria-label={tUi("contribute_menu")} className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-serif text-[28px] leading-tight tracking-[-0.02em] text-(--t-ink-base)">
            {tUi("contribute")}
          </h2>
          <p className="m-0 mt-1 text-[13px] leading-relaxed text-(--t-ink-dim)">
            {t("lead")}
          </p>
        </div>
        {hubLink ? (
          <GlobalLink
            href={hubLink.href}
            onClick={onNavigate}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-3 text-[14px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) ${FOCUS}`}
          >
            {t("hub")}
            <Icon
              aria-hidden
              icon="mdi:arrow-top-right"
              width={14}
              height={14}
            />
          </GlobalLink>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 bg-(--t-bg-void) p-4">
        {menu.status === "signedOut" ? (
          <SignInCard onNavigate={onNavigate} />
        ) : null}
        {menu.status === "loading" ? <LoadingRow /> : null}
        {review ? (
          <ReviewShortcut card={review} onNavigate={onNavigate} />
        ) : null}
        {tools.length > 0 ? (
          <CardGroup
            title={tUi("your_work")}
            cards={tools}
            library={menu.library}
            onNavigate={onNavigate}
            columns={tools.length > 1}
          />
        ) : null}
        {hub ? (
          <CardGroup
            title={t("getInvolved")}
            cards={[hub]}
            library={menu.library}
            onNavigate={onNavigate}
          />
        ) : null}
        {drives ? (
          <CardGroup
            title={drives.title}
            cards={[drives]}
            library={menu.library}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
      <MembershipRow plan={menu.plan} onNavigate={onNavigate} />
    </nav>
  )
}

/**
 * The header's primary action: a Contribute button that opens a 680px
 * panel of grouped shortcuts for the work the viewer can do. Open for
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
      <HeaderDropdownTrigger kind="popover" asChild>
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
      </HeaderDropdownTrigger>

      <HeaderDropdownContent
        kind="popover"
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          // Land on the first link rather than on the panel itself.
          const first =
            contentRef.current?.querySelector<HTMLElement>("a, button, select")
          if (first) {
            event.preventDefault()
            first.focus()
          }
        }}
        className="w-[680px] p-0"
      >
        <ContributeMenuPanel menu={menu} onNavigate={() => setOpen(false)} />
      </HeaderDropdownContent>
    </Popover>
  )
}

GlobalContributeMenu.displayName = "GlobalContributeMenu"

export default GlobalContributeMenu
