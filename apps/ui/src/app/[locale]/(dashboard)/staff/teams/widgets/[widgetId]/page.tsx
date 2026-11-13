import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"
import { withMessages } from "@/i18n/scoped-messages"

async function Page({
  params,
}: {
  readonly params: Promise<{ widgetId: string }>
}) {
  const { widgetId } = await params

  return <WidgetsStaffPage mode="build" id={widgetId} />
}

export default withMessages(
  Page,
  "[locale]/(dashboard)/staff/teams/widgets/[widgetId]/page"
)
