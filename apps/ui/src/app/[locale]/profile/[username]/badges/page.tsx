import { BadgesTab } from "../_components/tabs/BadgesTab"

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return <BadgesTab username={username} />
}
