"use client"

import { Icon } from "@iconify/react"
import { LIBRARY_NOTICE_LABELS, noticeEndDate } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { Badge, Sheet } from "@/components/ds"
import type { WizardTimetableContext } from "@/components/library-editor/wizard.types"
import { LibraryNoticeForm } from "@/components/staff/LibraryNoticeForm"
import { noticeDates } from "@/components/staff/StaffNotices"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"

const OUTLINED =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 text-[13px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** Published service notices are independent of the timetable draft. */
export function TimetableServiceNotices({
  context,
}: {
  readonly context: WizardTimetableContext
}) {
  const tUi = useUiTranslations("ui")

  const { notices, today, staff } = context
  const [posting, setPosting] = useState(false)
  const router = useRouter()
  const current = notices.filter((n) => !n.endedAt && noticeEndDate(n) >= today)

  return (
    <>
      <section
        className="rounded-[16px] border p-4"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
        aria-labelledby="service-notices-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="service-notices-heading"
              className="m-0 text-[14px] font-semibold"
            >
              Service notices
            </h2>
            <p
              className="m-0 mt-0.5 text-[12px] leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              Notices publish separately from the timetable and cancel visits
              while they apply.
            </p>
          </div>
          {staff ? (
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              onClick={() => setPosting(true)}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:plus"
                width={16}
                style={{ color: T.accent.primary }}
              />
              Add a notice
            </button>
          ) : null}
        </div>
        {current.length ? (
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {current.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start gap-2 rounded-[12px] border px-3 py-2.5"
                style={{ borderColor: T.border.line }}
              >
                <Badge
                  label={LIBRARY_NOTICE_LABELS[n.type]}
                  color={n.type === "not_running" ? "warn" : "aurora"}
                  icon={
                    n.type === "not_running"
                      ? "mdi:alert-outline"
                      : "mdi:information-outline"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-relaxed">
                    {n.message}
                  </span>
                  <span
                    className="mt-0.5 block text-[11px]"
                    style={{ color: T.ink.dim }}
                  >
                    {noticeDates(n)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-3 text-[13px]" style={{ color: T.ink.dim }}>
            No notices showing. The timetable runs as published.
          </p>
        )}
        {staff ? (
          <p className="m-0 mt-3 text-[12px]">
            <Link
              href={staffLibraryHref(staff.slug, "/notices")}
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Manage every notice
            </Link>
          </p>
        ) : null}
      </section>
      <Sheet
        open={posting}
        onClose={() => setPosting(false)}
        side="right"
        title={tUi("post_a_notice")}
      >
        {staff ? (
          <LibraryNoticeForm
            libraryDocumentId={staff.documentId}
            mobile
            today={today}
            stops={staff.stops}
            cycleWeeks={staff.cycleWeeks}
            embedded
            onSaved={() => {
              setPosting(false)
              router.refresh()
            }}
          />
        ) : null}
      </Sheet>
    </>
  )
}
