import { ActivityTab } from "../_components/tabs/ActivityTab"

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return <ActivityTab username={username} />
}
