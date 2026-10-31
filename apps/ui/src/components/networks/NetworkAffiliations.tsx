import { type NetworkAffiliation, networkHref } from "@repo/shared-data"

import { Link } from "@/lib/navigation"

export type ProfileNetworkAffiliation = Pick<
  NetworkAffiliation,
  "network" | "role" | "department" | "status"
>
export function NetworkAffiliations({
  affiliations,
}: {
  readonly affiliations: readonly ProfileNetworkAffiliation[]
}) {
  if (!affiliations.length) return null

  return (
    <section className="my-6 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-6">
      <h2 className="type-h2">Services and networks</h2>
      <ul className="m-0 list-none space-y-3 p-0">
        {affiliations.map((row) => (
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
