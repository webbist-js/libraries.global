"use client"

import { DRIVE_PROPOSAL_MIN_ACCEPTED } from "@repo/access"
import {
  ArrowUpRight,
  ChevronRight,
  Flag,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  Plus,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"

import { ResumeWork } from "@/app/[locale]/(dashboard)/contribute/_components/hub/ResumeWork"
import { Drawer } from "@/components/ds/Drawer"
import {
  CardMonogram,
  LibrarySelect,
  PlanPill,
} from "@/components/global/ContributeMenuParts"
import GlobalLink from "@/components/global/GlobalLink"
import {
  useContributeMenu,
  type ContributeMenu,
} from "@/hooks/useContributeMenu"
import { useMySubmissions } from "@/hooks/useSubmissions"
import type {
  ContributorCard,
  ContributorLink,
} from "@/lib/contributor-shortcuts"
import { cn } from "@/lib/styles"

function ActionRow({
  link,
  onNavigate,
  icon = "plus",
}: {
  readonly link: ContributorLink
  readonly onNavigate: () => void
  readonly icon?: "plus" | "inbox" | "flag"
}) {
  const Icon = icon === "inbox" ? Inbox : icon === "flag" ? Flag : Plus

  return (
    <GlobalLink
      href={link.href}
      onClick={onNavigate}
      className="contribute-action-row"
    >
      <span className="contribute-action-icon">
        <Icon size={18} aria-hidden />
      </span>
      <span>
        <strong>{link.label}</strong>
        {link.sub ? <small>{link.sub}</small> : null}
      </span>
      {link.badge ? (
        <span className="contribute-count">{link.badge}</span>
      ) : null}
      <ChevronRight size={16} aria-hidden />
    </GlobalLink>
  )
}
function WorkSection({
  card,
  menu,
  onNavigate,
}: {
  readonly card: ContributorCard
  readonly menu: ContributeMenu
  readonly onNavigate: () => void
}) {
  const t = useTranslations("contributionDrawer")

  return (
    <section className="contribute-work-section">
      <div className="contribute-section-heading">
        <CardMonogram icon={card.icon} tint={card.tint} size={30} />
        <div>
          <h3 className="type-label m-0">{card.title}</h3>
          <p>{card.description}</p>
        </div>
      </div>
      {card.key === "libraries" && menu.library.options.length > 1 ? (
        <LibrarySelect library={menu.library} />
      ) : null}
      <div
        role="list"
        aria-label={card.title}
        className="contribute-work-links"
      >
        {card.links.map((link) => (
          <div
            role="listitem"
            key={`${link.href}:${link.label}`}
            className="contents"
          >
            <GlobalLink href={link.href} onClick={onNavigate}>
              <span>
                {link.label}
                {link.sub ? <small>{link.sub}</small> : null}
              </span>
              {link.badge ? (
                <span className="contribute-count">
                  {link.badge}
                  <span className="sr-only"> {t("waiting")}</span>
                </span>
              ) : null}
              <ChevronRight size={15} aria-hidden />
            </GlobalLink>
          </div>
        ))}
      </div>
    </section>
  )
}
function RecentSubmissions({
  onNavigate,
}: {
  readonly onNavigate: () => void
}) {
  const query = useMySubmissions(),
    t = useTranslations("contributionDrawer"),
    locale = useLocale()
  const rows = [...(query.data ?? [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  return (
    <section className="contribute-recent">
      <div className="contribute-section-heading">
        <h2 className="type-label m-0">{t("submissions")}</h2>
        <GlobalLink href="/contribute/submissions" onClick={onNavigate}>
          {t("seeAll")}
        </GlobalLink>
      </div>
      {query.isLoading ? (
        <p role="status">{t("loading")}</p>
      ) : query.error ? (
        <p role="status">{t("unavailable")}</p>
      ) : !rows.length ? (
        <p>{t("noSubmissions")}</p>
      ) : (
        rows.map((row) => (
          <GlobalLink
            key={row.documentId}
            href="/contribute/submissions"
            onClick={onNavigate}
            className="contribute-submission"
          >
            <span>
              <strong>
                {row.targetLabel || row.editSummary || t("submission")}
              </strong>
              <small>
                {new Date(row.updatedAt).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                })}
              </small>
            </span>
            <span
              className="contribute-submission-status"
              data-status={row.status}
            >
              {t(`status.${row.status}`)}
            </span>
          </GlobalLink>
        ))
      )}
    </section>
  )
}

/** Capabilities remain owned by the existing menu model and checked again by every destination. */
function FeaturedDrive({
  featured,
  onNavigate,
}: {
  featured: ContributorCard["featured"]
  onNavigate: () => void
}) {
  const t = useTranslations("contributionDrawer")

  return (
    <>
      {featured === "loading" ? (
        <p role="status">{t("loadingDrive")}</p>
      ) : featured ? (
        <GlobalLink href={featured.href} onClick={onNavigate}>
          <strong>{featured.title}</strong>
          {featured.progress ? <small>{featured.progress}</small> : null}
          <progress
            max={100}
            value={featured.percent}
            aria-label={featured.title}
          />
        </GlobalLink>
      ) : (
        <p>{t("noFeaturedDrive")}</p>
      )}
    </>
  )
}

export function ContributeMenuPanel({
  menu,
  onNavigate,
}: {
  readonly menu: ContributeMenu
  readonly onNavigate: () => void
  readonly layout?: "popover" | "sidebar"
}) {
  const t = useTranslations("contributionDrawer"),
    ui = useTranslations("ui"),
    shared = useTranslations("contributeMenu")
  const hub = menu.common.find((card) => card.key === "hub"),
    drives = menu.common.find((card) => card.key === "drives")
  const actions = hub?.links.filter((link) => link.href !== "/contribute") ?? []
  const proposal = drives?.links.find(
    (link) =>
      link.href === "/community/propose" ||
      link.href === "/community/drives/new"
  )
  const locked =
    proposal?.href === "/community/propose" &&
    menu.acceptedCount != null &&
    menu.acceptedCount < DRIVE_PROPOSAL_MIN_ACCEPTED
  const featured = drives?.featured

  return (
    <nav
      className="contribute-drawer-content"
      aria-label={ui("contribute_menu")}
    >
      <div className="contribute-drawer-scroll">
        <p className="contribute-intro">
          {t(menu.status === "signedOut" ? "visitorLead" : "lead")}
        </p>
        <GlobalLink
          href="/contribute"
          onClick={onNavigate}
          className="contribute-hub-link"
        >
          {shared("hub")} <ArrowUpRight size={15} aria-hidden />
        </GlobalLink>
        {menu.status === "loading" ? (
          <p role="status" className="contribute-loading">
            <LoaderCircle
              size={18}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            {shared("loading")}
          </p>
        ) : null}
        {menu.status === "signedOut" ? (
          <section className="contribute-signin">
            <h2 className="type-label m-0">{ui("contributing_is_free")}</h2>
            <p>{t("accountLead")}</p>
            <div>
              <GlobalLink href="/auth/register" onClick={onNavigate}>
                {ui("create_account")}
              </GlobalLink>
              <GlobalLink href="/auth/signin" onClick={onNavigate}>
                {ui("sign_in")}
              </GlobalLink>
            </div>
          </section>
        ) : null}
        {menu.status === "signedIn" ? (
          <ResumeWork compact onNavigate={onNavigate} />
        ) : null}
        <section
          role="group"
          aria-label={shared("getInvolved")}
          className="contribute-involved"
        >
          <h2 className="type-label">{shared("getInvolved")}</h2>
          {actions.map((link) => (
            <ActionRow
              key={link.href}
              link={link}
              icon={link.href.includes("submissions") ? "inbox" : "plus"}
              onNavigate={onNavigate}
            />
          ))}
          {proposal ? (
            locked ? (
              <div
                className="contribute-action-row contribute-action-locked"
                aria-disabled="true"
              >
                <span className="contribute-action-icon">
                  <LockKeyhole size={18} aria-hidden />
                </span>
                <span>
                  <strong>{proposal.label}</strong>
                  <small>
                    {t("unlockDrive", { count: DRIVE_PROPOSAL_MIN_ACCEPTED })}
                  </small>
                </span>
                <span className="contribute-count">
                  {menu.acceptedCount} / {DRIVE_PROPOSAL_MIN_ACCEPTED}
                </span>
              </div>
            ) : (
              <ActionRow link={proposal} icon="flag" onNavigate={onNavigate} />
            )
          ) : null}
        </section>
        <section
          role="group"
          aria-label={t("drives")}
          className="contribute-featured"
        >
          <div className="contribute-section-heading">
            <h2 className="type-label m-0">{t("drives")}</h2>
            <GlobalLink href="/community" onClick={onNavigate}>
              {t("allDrives")}
            </GlobalLink>
          </div>
          <FeaturedDrive featured={featured} onNavigate={onNavigate} />
        </section>
        {menu.work.length ? (
          <section
            role="group"
            aria-label={ui("your_work")}
            className="contribute-work"
          >
            <h2 className="type-label">{ui("your_work")}</h2>
            {menu.work.map((card) => (
              <WorkSection
                key={card.key}
                card={card}
                menu={menu}
                onNavigate={onNavigate}
              />
            ))}
          </section>
        ) : null}
        {menu.status === "signedIn" ? (
          <RecentSubmissions onNavigate={onNavigate} />
        ) : null}
        <ol className="contribute-review-steps">
          {(["send", "review", "outcome"] as const).map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <div>
                <strong>{t(step)}</strong>
                <small>{t(`${step}Lead`)}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <GlobalLink
        href={menu.plan ? "/contribute/membership" : "/plans"}
        onClick={onNavigate}
        className="contribute-membership"
      >
        <CardMonogram icon="mdi:heart-outline" tint="accent" size={30} />
        <span>
          <strong>{ui(menu.plan ? "membership" : "plans_and_pricing")}</strong>
          <small>
            {menu.plan === "pro" ? t("earnedPro") : t("freeContribution")}
          </small>
        </span>
        {menu.plan ? <PlanPill plan={menu.plan} /> : null}
        <ChevronRight size={16} aria-hidden />
      </GlobalLink>
    </nav>
  )
}
export function GlobalContributeMenu({
  className = "",
}: {
  readonly className?: string
}) {
  const ui = useTranslations("ui"),
    path = usePathname() ?? "/",
    id = useId()
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  if (openedAt !== null && openedAt !== path) setOpenedAt(null)
  const open = openedAt === path,
    menu = useContributeMenu(open)

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          setTrigger(event.currentTarget)
          setOpenedAt(open ? null : path)
        }}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-action-primary) px-4 text-sm font-semibold text-white",
          className
        )}
      >
        <Plus size={18} aria-hidden />
        {ui("contribute")}
      </button>
      <Drawer
        open={open}
        side="left"
        titleId={id}
        title={ui("contribute_menu")}
        initialFocus={(panel) =>
          panel.querySelector<HTMLElement>(".contribute-hub-link")
        }
        onClose={() => setOpenedAt(null)}
        returnFocusTo={trigger}
        className="contribute-menu-drawer"
      >
        <ContributeMenuPanel menu={menu} onNavigate={() => setOpenedAt(null)} />
      </Drawer>
    </>
  )
}
GlobalContributeMenu.displayName = "GlobalContributeMenu"

export default GlobalContributeMenu
