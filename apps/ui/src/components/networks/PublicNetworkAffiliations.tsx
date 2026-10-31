import { readPublicNetwork } from "@/lib/networks/server"

import {
  NetworkAffiliations,
  type ProfileNetworkAffiliation,
} from "./NetworkAffiliations"

export async function PublicNetworkAffiliations({
  username,
}: {
  readonly username: string
}) {
  const data = await readPublicNetwork<{
    affiliations: ProfileNetworkAffiliation[]
  }>(`network-affiliations/${encodeURIComponent(username)}`).catch(() => null)

  return data ? <NetworkAffiliations affiliations={data.affiliations} /> : null
}
