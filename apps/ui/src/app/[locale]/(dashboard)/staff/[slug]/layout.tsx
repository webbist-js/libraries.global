import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { Container } from "@/components/elementary/Container"
import { withMessages } from "@/i18n/scoped-messages"
import { canStaffTool } from "@/lib/access-server"
import { fetchStaffLibraryMeta, loadStaffPage } from "@/lib/staff/server"

import { StaffShell } from "./_components/StaffShell"

async function StaffLibraryLayout({
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
  // Staff tools are free: the viewer's own verified claim decides.
  const canSeeTeam = canStaffTool(user, "seeTeam", documentId)

  return (
    <>
      <StaffShell
        overview={overview}
        libraries={libraries}
        meta={meta}
        canSeeTeam={canSeeTeam}
      />
      <Container className="py-8 sm:py-12">{children}</Container>
    </>
  )
}

export default withMessages(
  StaffLibraryLayout,
  "[locale]/(dashboard)/staff/[slug]/layout"
)
