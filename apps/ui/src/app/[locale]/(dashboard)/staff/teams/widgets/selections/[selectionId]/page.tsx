import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"
import { withMessages } from "@/i18n/scoped-messages"

async function Page({
  params,
}: {
  readonly params: Promise<{ selectionId: string }>
}) {
  const { selectionId } = await params

  return <WidgetsStaffPage mode="selection" id={selectionId} />
}

export default withMessages(
  Page,
  "[locale]/(dashboard)/staff/teams/widgets/selections/[selectionId]/page"
)
