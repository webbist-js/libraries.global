import { ContributionsSection } from "../_components/sections/ContributionsSection"

export default async function ContributionsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  return <ContributionsSection username={username} />
}
