import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"
import { withMessages } from "@/i18n/scoped-messages"

function Page() {
  return <WidgetsStaffPage mode="new" />
}

export default withMessages(
  Page,
  "[locale]/(dashboard)/staff/teams/widgets/new/page"
)
