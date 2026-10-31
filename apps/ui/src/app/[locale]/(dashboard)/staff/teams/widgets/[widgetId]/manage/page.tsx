import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"

export default async function Page({
  params,
}: {
  readonly params: Promise<{ widgetId: string }>
}) {
  const { widgetId } = await params

  return <WidgetsStaffPage mode="manage" id={widgetId} />
}
