"use client"
import {
  LIBRARY_NOTICE_LABELS,
  noticeIsActive,
  noticeIsUpcoming,
  noticeLocalDate,
  type LibraryNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Notice, StatusBadge } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { shortDate } from "@/lib/staff/format"

export function LibraryNoticeBanners({
  notices,
  timezone,
}: {
  notices: readonly LibraryNotice[]
  timezone: string | null
}) {
  const tUi = useUiTranslations("ui")

  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setToday(noticeLocalDate(new Date(), timezone))
    update()
    const timer = setInterval(update, 60_000)

    return () => clearInterval(timer)
  }, [timezone])
  if (!today) return null
  const active = notices.filter((n) => noticeIsActive(n, today)),
    upcoming = notices.filter((n) => noticeIsUpcoming(n, today))
  if (!active.length && !upcoming.length) return null

  return (
    <section aria-label={tUi("library_notices")} className="my-6 space-y-4">
      {active.map((n) => (
        <Notice
          key={n.id}
          icon={
            ["closure", "not_running"].includes(n.type)
              ? "mdi:alert-outline"
              : "mdi:information-outline"
          }
          tone={["closure", "not_running"].includes(n.type) ? "warn" : "info"}
          title={LIBRARY_NOTICE_LABELS[n.type]}
        >
          <p className="m-0">{n.message}</p>
        </Notice>
      ))}
      {upcoming.map((n) => (
        <div
          key={n.id}
          className="flex flex-wrap items-start gap-3 rounded-[16px] border px-4 py-3"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <StatusBadge tone="info" icon="mdi:calendar-clock-outline">
            From {shortDate(n.from)} · {LIBRARY_NOTICE_LABELS[n.type]}
          </StatusBadge>
          <p className="m-0 min-w-0 flex-1 text-base leading-[1.5]">
            {n.message}
          </p>
        </div>
      ))}
    </section>
  )
}
