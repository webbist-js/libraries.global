import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { registerLiveIcons } from "./icons"

const POINTS = [
  "The public sees the vehicle’s state and stop, never a staff name.",
  "Position between stops is rounded to about 250 m and a minute behind, or not shown.",
  "Sharing ends on its own after the last stop.",
  "Location points are deleted after 24 hours. Check-ins are kept for 90 days.",
]

/** The Go live tab's privacy card: what live sharing keeps and shows. */
registerLiveIcons()

export function LivePrivacyCard({
  libraryDocumentId,
}: {
  readonly libraryDocumentId: string
}) {
  const tUi = useUiTranslations("ui")

  const staffHref = useStaffLibraryHref(libraryDocumentId)

  return (
    <aside
      className="rounded-[24px] border p-5 sm:p-6 lg:sticky lg:top-32 lg:self-start"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="live-privacy-heading"
    >
      <h3
        id="live-privacy-heading"
        className="m-0 flex items-center gap-2 text-[20px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:shield-lock-outline"
          width={20}
          style={{ color: T.accent.primary }}
        />
        {tUi("privacy")}
      </h3>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[14.5px]">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2.5">
            <Icon
              aria-hidden="true"
              icon="mdi:check"
              width={18}
              className="mt-0.5 shrink-0"
              style={{ color: T.accent.ok }}
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <p
        className="mt-4 mb-0 rounded-[14px] px-4 py-3 text-[13.5px]"
        style={{ background: T.bg.surface, color: T.ink.dim }}
      >
        Your library should cover live tracking in its own staff data-protection
        checks.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        <Link
          className="font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
          href="/privacy"
        >
          Read the privacy notice
        </Link>
        <Link
          className="font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
          href={staffHref("/team")}
        >
          Report a problem
        </Link>
      </div>
    </aside>
  )
}
