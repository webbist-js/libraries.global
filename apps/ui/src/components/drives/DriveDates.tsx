import { Icon } from "@iconify/react"
import { driveDateLabel } from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import type { Drive } from "@/lib/drives/types"

import { longDate } from "./focus-meta"

/**
 * A Drive's dates by the shared rule (spec §5.8): "Ends 31 Oct", "12 days
 * left", and within a week the warning tone: a clock icon plus the text in
 * the danger colour, never colour alone. `size="lg"` is the big card's serif.
 */
export function DriveDates({
  drive,
  now,
  size = "sm",
  detail = false,
}: {
  readonly drive: Pick<Drive, "status" | "startsAt" | "endsAt" | "closedAt">
  /** Defaults to the time of render. */
  readonly now?: Date
  readonly size?: "sm" | "lg"
  readonly detail?: boolean
}) {
  const t = useTranslations("drivePage")
  const { text, tone } = driveDateLabel(drive, now ?? new Date())
  const warn = tone === "warn"
  const lg = size === "lg"

  return (
    <span
      data-tone={tone}
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{
        color: warn
          ? T.accent.danger
          : detail && drive.status === "open"
            ? T.accent.warn
            : T.ink.dim,
        fontFamily: lg ? T.font.serif : undefined,
        fontSize: lg ? 22 : detail ? 12 : 14,
        fontWeight: lg ? 500 : 600,
        lineHeight: 1.2,
      }}
    >
      {warn ? (
        <Icon
          aria-hidden="true"
          height={lg ? 20 : 15}
          icon="mdi:clock-alert-outline"
          width={lg ? 20 : 15}
        />
      ) : null}
      {detail && drive.status === "open"
        ? t("endsWithDays", {
            date: longDate(drive.endsAt),
            days: Math.max(
              0,
              Math.ceil(
                (Date.parse(drive.endsAt) - (now ?? new Date()).getTime()) /
                  86_400_000
              )
            ),
          })
        : text}
    </span>
  )
}
