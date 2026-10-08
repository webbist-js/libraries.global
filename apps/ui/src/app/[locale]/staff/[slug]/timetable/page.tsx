import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { StaffTimetableEditor } from "@/components/mobile/StaffTimetableEditor"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import type { StaffNoticesData } from "@/components/staff/StaffNotices"
import { T } from "@/lib/design-tokens"
import { fetchMobileTimetable } from "@/lib/mobile/server"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"
import { fetchStaff } from "@/lib/staff-proxy"

export const metadata = privateMetadata("Timetable")

export default async function StaffTimetablePage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params,
    { user, overview, documentId } = await loadStaffPage(
      slug,
      await staffPathname()
    )
  if (overview.library.libraryType !== "Mobile") notFound()
  const [library, notices] = await Promise.all([
    fetchMobileTimetable(documentId),
    fetchStaff<StaffNoticesData>(user, `libraries/${documentId}/notices`),
  ])
  if (!library) notFound()
  const noticeData = notices.body ?? {
    data: [],
    today: new Date().toISOString().slice(0, 10),
    timezone: library.timezone,
    stops:
      library.timetable?.stops.map((s) => ({ id: s.id, name: s.name })) ?? [],
    cycleWeeks: library.timetable?.cycle.weeks ?? 1,
  }

  return (
    <div>
      <p
        className="m-0 mb-6 max-w-[60ch] text-[15px]"
        style={{ color: T.ink.dim }}
      >
        Changes publish when you press Publish timetable. Everyone shares this
        timetable, whichever language they use.
      </p>
      <StaffTimetableEditor
        id={documentId}
        initial={library.timetable}
        locale={routing.defaultLocale}
        notices={noticeData.data}
        timezone={noticeData.timezone || library.timezone}
        today={noticeData.today}
        stops={noticeData.stops}
      />
      <LearnMoreLink
        slug={KNOWLEDGE_SLUGS.timetable}
        locale={locale as Locale}
        className="mt-6"
      />
    </div>
  )
}
