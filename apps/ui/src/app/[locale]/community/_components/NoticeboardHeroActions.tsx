import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { proposeHref } from "@/lib/drives/propose-link"

/**
 * Where "Propose a drive" goes: the builder, or sign-in first with the
 * builder to come back to. The board makes drives directly (OD-8).
 */
export function proposeActionHref(board: boolean, signedIn: boolean): string {
  if (board) return "/community/drives/new"
  if (signedIn) return proposeHref()

  return `/auth/signin?callbackUrl=${encodeURIComponent(proposeHref())}`
}

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * The Noticeboard hero's slot (spec §5.5): "Propose a drive" (board
 * members see "New drive") and, while drives are open, how many and how
 * much help they have. `helping` adds up each open drive's helpers, so
 * someone in two drives counts twice: it says "helping", not "people".
 */
export function NoticeboardHeroActions({
  board,
  signedIn,
  openCount,
  helping,
}: {
  readonly board: boolean
  readonly signedIn: boolean
  readonly openCount: number
  readonly helping: number
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <GlobalLink
          href={proposeActionHref(board, signedIn)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-[22px] py-3 text-base font-semibold no-underline hover:border-(--t-accent-primary)"
          style={{ color: T.ink.base }}
        >
          <Icon
            aria-hidden="true"
            icon={board ? "mdi:plus" : "mdi:pin-outline"}
            width={18}
          />
          {board ? tUi("new_drive") : "Propose a drive"}
        </GlobalLink>
      </div>
      {openCount > 0 ? (
        <p className="m-0 text-base" style={{ color: T.ink.dim }}>
          {fmt(openCount)} open {openCount === 1 ? "drive" : "drives"} ·{" "}
          {fmt(helping)} helping
        </p>
      ) : null}
    </div>
  )
}
