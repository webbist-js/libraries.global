"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"

import { useMounted } from "@/hooks/useMounted"
import { useStaff } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { mobileConsoleHref } from "@/lib/mobile-app"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"

import { LibraryClaimButton } from "./LibraryClaimButton"

/** Ink on the dark card at reduced strength, from the surface token. */
const ON_DARK_DIM = `color-mix(in srgb, ${T.bg.deep} 78%, transparent)`
const ON_DARK_LOW = `color-mix(in srgb, ${T.bg.deep} 70%, transparent)`

/**
 * The library page's one staff card, dark on the paper: "You run this
 * library", a white "Go live" pill for Mobile staff who may go live (or a
 * line saying who to ask), "Connect an event feed" while none is live, and
 * the staff area link. Everyone else sees the claim button. Until the
 * component has mounted and the session is known, a same-height
 * placeholder holds the space: the page is static, and Better Auth's store
 * can already hold a session on the client's first render, so the server
 * and client markup only agree if neither reads it before mount.
 */
export function StaffLibraryEntry(props: {
  readonly compact?: boolean
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryEntityRef?: string
  readonly libraryType?: string | null
  /** Whether the library has an active event feed (the record's flag). */
  readonly hasActiveFeed?: boolean | null
}) {
  const tUi = useUiTranslations("ui")
  const locale = useLocale()

  const staff = useStaff()
  const mounted = useMounted()
  if (!mounted || !staff.ready)
    return (
      <div
        aria-hidden="true"
        className="min-h-[52px] rounded-[20px]"
        style={{ background: T.bg.surface }}
      />
    )
  if (!staff.can("edit", props.libraryDocumentId))
    return <LibraryClaimButton {...props} />
  const mobile =
    (props.libraryType ??
      staff.libraries.find((l) => l.id === props.libraryDocumentId)
        ?.libraryType) === "Mobile"
  const canGoLive = mobile && staff.can("goLive", props.libraryDocumentId)
  const base = staffLibraryHref(props.librarySlug)

  if (props.compact)
    return (
      <CompactStaffTools
        canGoLive={canGoLive}
        mobile={mobile}
        base={base}
        locale={locale}
        libraryDocumentId={props.libraryDocumentId}
        hasActiveFeed={props.hasActiveFeed}
      />
    )

  return (
    <section
      className="rounded-[20px] p-5"
      style={{ background: T.ink.base, color: T.bg.deep }}
      aria-labelledby="staff-entry-heading"
    >
      <p
        className="m-0 flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: ON_DARK_LOW }}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:shield-account-outline"
          width={15}
          height={15}
        />
        Library staff
      </p>
      <h2 id="staff-entry-heading" className="type-panel-title m-0 mt-2">
        You run this {mobile ? "mobile library" : "library"}
      </h2>
      <p
        className="my-2 text-base leading-normal"
        style={{ color: ON_DARK_DIM }}
      >
        {mobile
          ? "Share today’s route live from your phone. The public sees the vehicle, never your name."
          : "Keep the record, hours and notices up to date."}
      </p>
      {mobile && !canGoLive ? (
        <p
          className="m-0 flex items-center gap-1.5 text-sm"
          style={{ color: ON_DARK_DIM }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:broadcast-off"
            width={15}
            height={15}
          />
          Live updates are off for you: ask an owner.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {canGoLive ? (
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-base font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
            style={{ color: T.ink.base }}
            href={mobileConsoleHref(props.libraryDocumentId, locale)}
          >
            <Icon
              aria-hidden="true"
              height={12}
              icon="mdi:circle"
              width={12}
              style={{ color: T.accent.ok }}
            />
            {tUi("go_live")}
          </Link>
        ) : null}
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold underline underline-offset-4"
          style={{ color: T.bg.deep }}
          href={base}
        >
          {tUi("open_the_staff_area")}
          <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
        </Link>
        {props.hasActiveFeed ? null : (
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold underline underline-offset-4"
            style={{ color: ON_DARK_DIM }}
            href={`${base}/events/connect`}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:calendar-sync-outline"
              width={16}
            />
            Connect an event feed
          </Link>
        )}
      </div>
    </section>
  )
}

function CompactStaffTools({
  canGoLive,
  mobile,
  base,
  locale,
  libraryDocumentId,
  hasActiveFeed,
}: {
  canGoLive: boolean
  mobile: boolean
  base: string
  locale: string
  libraryDocumentId: string
  hasActiveFeed?: boolean | null
}) {
  const tUi = useUiTranslations("ui")
  const tPage = useUiTranslations("libraryPage")

  return (
    <div
      className="mt-3 flex flex-col items-start gap-1 border-t pt-3"
      style={{ borderColor: T.border.line }}
    >
      <p className="m-0 text-xs font-semibold" style={{ color: T.ink.dim }}>
        {tPage("staffTools")}
      </p>
      {canGoLive ? (
        <Link
          href={mobileConsoleHref(libraryDocumentId, locale)}
          className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
        >
          {tUi("go_live")}
        </Link>
      ) : null}
      <Link
        href={base}
        className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
      >
        {tUi("open_the_staff_area")}
      </Link>
      {!hasActiveFeed ? (
        <Link
          href={`${base}/events/connect`}
          className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
        >
          {tPage("connectEvents")}
        </Link>
      ) : null}
      {mobile && !canGoLive ? (
        <p className="m-0 text-xs" style={{ color: T.ink.dim }}>
          {tPage("livePermission")}
        </p>
      ) : null}
    </div>
  )
}
