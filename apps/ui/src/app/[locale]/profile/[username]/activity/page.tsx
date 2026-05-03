import { ActivitySection } from "../_components/sections/ActivitySection"

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return <ActivitySection username={username} />
}
