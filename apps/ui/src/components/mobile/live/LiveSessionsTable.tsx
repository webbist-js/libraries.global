import { fromMinutes, localDateTime } from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { Badge, type BadgeColor } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { ConsoleSession } from "@/lib/mobile-live/types"
import { shortDate } from "@/lib/staff/format"

export type SessionLog = ConsoleSession & {
  checkIns: number
  totalStops: number
  flags: string[]
  startedByName?: string
}

const DAYS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
}

/** "Live sessions · last 90 days" as a real table with row headers. */
export function LiveSessionsTable({
  logs,
  timezone,
}: {
  readonly logs: SessionLog[]
  readonly timezone: string
}) {
  const tStatic = useTranslations("staticUi")

  const END: Record<
    string,
    { label: string; color: BadgeColor; icon: string }
  > = {
    auto: {
      label: tStatic("mobile.automatic"),
      color: "dim",
      icon: "mdi:timer-outline",
    },
    manual: {
      label: tStatic("mobile.by_hand"),
      color: "dim",
      icon: "mdi:hand-back-left-outline",
    },
    breakdown: {
      label: tStatic("mobile.breakdown"),
      color: "danger",
      icon: "mdi:bus-alert",
    },
    takeover: {
      label: tStatic("mobile.taken_over"),
      color: "warn",
      icon: "mdi:swap-horizontal",
    },
    revoked: {
      label: tStatic("mobile.access_removed"),
      color: "warn",
      icon: "mdi:account-off-outline",
    },
    expired: {
      label: tStatic("mobile.expired"),
      color: "dim",
      icon: "mdi:clock-alert-outline",
    },
    kill_switch: {
      label: tStatic("mobile.live_sharing_disabled"),
      color: "warn",
      icon: "mdi:power",
    },
  }

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  /** "10:14" in the library's zone, the same on the server and the client. */
  const time = (iso: string) =>
    fromMinutes(localDateTime(new Date(iso), timezone).minute)

  return (
    <section
      className="rounded-[24px] border p-5 sm:p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="live-sessions-heading"
    >
      <h3 id="live-sessions-heading" className="type-h3 m-0">
        {tStatic("mobile.live_sessions_last_90_days")}
      </h3>
      {!logs.length ? (
        <p className="mt-3 mb-0 text-base" style={{ color: T.ink.dim }}>
          {tStatic(
            "mobile.no_live_sessions_yet_the_first_route_you_share_appears_here"
          )}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              {tStatic("mobile.live_sessions_in_the_last_90_days")}
            </caption>
            <thead>
              <tr style={{ color: T.ink.dim }}>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  {tStatic("common.date")}
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  {tStatic("mobile.started_by")}
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  {tStatic("mobile.route")}
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  {tStatic("mobile.times")}
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  {tStatic("mobile.check_ins")}
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  {tStatic("mobile.ended")}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((s) => {
                const end = s.endReason ? END[s.endReason] : null

                return (
                  <tr
                    key={s.id}
                    className="border-t"
                    style={{ borderColor: T.border.divider }}
                  >
                    <th
                      scope="row"
                      className="py-2.5 pr-3 font-semibold whitespace-nowrap"
                    >
                      {shortDate(s.serviceDate)}
                    </th>
                    <td className="py-2.5 pr-3">
                      {s.startedByName ?? tExisting("staffOnboarding.eyebrow")}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {DAYS[s.day] ?? s.day}
                      {s.cycleWeek ? ` Week ${s.cycleWeek}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
                      {time(s.startedAt)}–{s.endedAt ? time(s.endedAt) : "now"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {s.checkIns} {tExisting("widgetPublic.of")} {s.totalStops}
                      {s.flags.length ? (
                        <span
                          className="block text-sm"
                          style={{ color: T.ink.dim }}
                        >
                          {s.flags.join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      {end ? (
                        <Badge
                          label={end.label}
                          color={end.color}
                          icon={end.icon}
                        />
                      ) : (
                        <Badge
                          label={tUi("live_now")}
                          color="ok"
                          icon="mdi:circle"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
