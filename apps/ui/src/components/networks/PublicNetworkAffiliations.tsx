import { networkHref, type NetworkAffiliation } from "@repo/shared-data"

import { Link } from "@/lib/navigation"
import { readPublicNetwork } from "@/lib/networks/server"

export async function PublicNetworkAffiliations({
  username,
}: {
  readonly username: string
}) {
  const data = await readPublicNetwork<{
    affiliations: Pick<
      NetworkAffiliation,
      "network" | "role" | "department" | "status"
    >[]
  }>(`network-affiliations/${encodeURIComponent(username)}`).catch(() => null)
  if (!data?.affiliations.length) return null

  return (
    <section className="my-6 rounded-2xl border border-(--t-border-line) bg-white p-6">
      <h2 className="type-h2">Services and networks</h2>
      <ul className="m-0 list-none space-y-3 p-0">
        {data.affiliations.map((row) => (
          <li key={row.network.documentId}>
            <Link
              href={networkHref(row.network.slug)}
              className="font-semibold underline underline-offset-4"
            >
              {row.network.name}
            </Link>
            <p>
              {row.role} ·{" "}
              {row.status === "verified"
                ? "Verified employment"
                : "Declared affiliation"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
