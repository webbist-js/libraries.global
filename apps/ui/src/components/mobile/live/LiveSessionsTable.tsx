import { fromMinutes, localDateTime } from "@repo/shared-data"

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

const END: Record<string, { label: string; color: BadgeColor; icon: string }> =
  {
    auto: { label: "Automatic", color: "dim", icon: "mdi:timer-outline" },
    manual: {
      label: "By hand",
      color: "dim",
      icon: "mdi:hand-back-left-outline",
    },
    breakdown: { label: "Breakdown", color: "danger", icon: "mdi:bus-alert" },
    takeover: {
      label: "Taken over",
      color: "warn",
      icon: "mdi:swap-horizontal",
    },
    revoked: {
      label: "Access removed",
      color: "warn",
      icon: "mdi:account-off-outline",
    },
    expired: {
      label: "Expired",
      color: "dim",
      icon: "mdi:clock-alert-outline",
    },
    kill_switch: {
      label: "Live sharing disabled",
      color: "warn",
      icon: "mdi:power",
    },
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
  /** "10:14" in the library's zone, the same on the server and the client. */
  const time = (iso: string) =>
    fromMinutes(localDateTime(new Date(iso), timezone).minute)

  return (
    <section
      className="rounded-[24px] border p-5 sm:p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="live-sessions-heading"
    >
      <h3
        id="live-sessions-heading"
        className="m-0 text-[20px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        Live sessions · last 90 days
      </h3>
      {!logs.length ? (
        <p className="mt-3 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
          No live sessions yet. The first route you share appears here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="sr-only">
              Live sessions in the last 90 days
            </caption>
            <thead>
              <tr style={{ color: T.ink.dim }}>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  Date
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  Started by
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  Route
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  Times
                </th>
                <th scope="col" className="pr-3 pb-2 font-semibold">
                  Check-ins
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Ended
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
                      {s.startedByName ?? "Library staff"}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {DAYS[s.day] ?? s.day}
                      {s.cycleWeek ? ` Week ${s.cycleWeek}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">
                      {time(s.startedAt)}–{s.endedAt ? time(s.endedAt) : "now"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {s.checkIns} of {s.totalStops}
                      {s.flags.length ? (
                        <span
                          className="block text-[12.5px]"
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
                        <Badge label="Live now" color="ok" icon="mdi:circle" />
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
