import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import {
  StaffNotices,
  type StaffNoticesData,
} from "@/components/staff/StaffNotices"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"
import { fetchStaff } from "@/lib/staff-proxy"

export const metadata = privateMetadata("Library notices")
export default async function NoticesPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const result = await fetchStaff<StaffNoticesData>(
    user,
    `libraries/${documentId}/notices`
  )
  if (result.status !== 200 || !result.body)
    return <StaffLoadError what="Notices" status={result.status} />

  return (
    <StaffNotices
      id={documentId}
      locale={locale}
      mobile={overview.library.libraryType === "Mobile"}
      initial={result.body}
    />
  )
}
