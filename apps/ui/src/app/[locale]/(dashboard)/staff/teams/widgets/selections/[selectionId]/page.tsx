import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"

export default async function Page({
  params,
}: {
  readonly params: Promise<{ selectionId: string }>
}) {
  const { selectionId } = await params

  return <WidgetsStaffPage mode="selection" id={selectionId} />
}
