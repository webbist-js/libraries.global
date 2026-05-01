import { ContributionsTab } from "../_components/tabs/ContributionsTab"

export default async function ContributionsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return <ContributionsTab username={username} />
}
