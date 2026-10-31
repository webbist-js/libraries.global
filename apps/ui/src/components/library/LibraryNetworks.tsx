import {
  NETWORK_KIND_LABELS,
  networkHref,
  type NetworkKind,
} from "@repo/shared-data"

import { Link } from "@/lib/navigation"

export type LibraryNetworkMembership = {
  documentId: string
  name?: string | null
  slug?: string | null
  kind?: NetworkKind | null
  publicPageEnabled?: boolean | null
  publicPageReviewedAt?: string | number | Date | null
}
export function LibraryNetworks({
  libraryId,
  networks = [],
}: {
  readonly libraryId: string
  readonly networks?: readonly LibraryNetworkMembership[] | null
}) {
  const visible = (networks ?? []).filter(
    (
      row
    ): row is LibraryNetworkMembership & {
      name: string
      slug: string
      kind: NetworkKind
    } =>
      !!row.name &&
      !!row.slug &&
      !!row.kind &&
      !!row.publicPageEnabled &&
      !!row.publicPageReviewedAt
  )
  if (!visible.length) return null

  return (
    <section
      className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-6"
      aria-label="Services and networks"
    >
      <h2 className="type-h2">Part of</h2>
      <ul className="m-0 list-none space-y-3 p-0">
        {visible.map((row) => (
          <li key={row.documentId}>
            <Link
              href={networkHref(row.slug)}
              className="font-semibold underline underline-offset-4"
            >
              {row.name}
            </Link>
            <span className="ml-2 text-sm text-(--t-ink-dim)">
              {NETWORK_KIND_LABELS[row.kind]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <Link
          href={`/staff/networks?network=${visible[0]!.documentId}&libraryId=${libraryId}`}
        >
          Work for the wider service? Request a grouped review.
        </Link>
      </p>
    </section>
  )
}
