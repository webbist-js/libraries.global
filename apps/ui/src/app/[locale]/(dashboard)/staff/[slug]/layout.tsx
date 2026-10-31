import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { Container } from "@/components/elementary/Container"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import { fetchStaffLibraryMeta, loadStaffPage } from "@/lib/staff/server"

import { StaffShell } from "./_components/StaffShell"

export default async function StaffLibraryLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { user, libraries, documentId, overview } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const meta = await fetchStaffLibraryMeta(documentId)
  const teamCovered =
    requireEntitlementForLibrary(user, "library.team", documentId) === null

  return (
    <>
      <StaffShell
        overview={overview}
        libraries={libraries}
        meta={meta}
        plan={user.plan ?? "free"}
        teamCovered={teamCovered}
      />
      <Container className="py-8 sm:py-12">{children}</Container>
    </>
  )
}
