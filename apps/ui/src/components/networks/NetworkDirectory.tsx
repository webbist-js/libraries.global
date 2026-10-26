import {
  NETWORK_KINDS,
  NETWORK_KIND_LABELS,
  networkHref,
} from "@repo/shared-data"

import { EmptyState } from "@/components/ds/EmptyState"
import { NetworkCountryFilter } from "@/components/networks/NetworkCountryFilter"
import { STAFF_FIELD, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import type { NetworkList } from "@/lib/networks/types"

export function NetworkDirectory({
  data,
  query,
  basePath = "/library-networks",
}: {
  readonly data: NetworkList
  readonly query: URLSearchParams
  readonly basePath?: string
}) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams(query)
    params.set("page", String(page))

    return `${basePath}?${params}`
  }

  return (
    <div className="space-y-8">
      <form
        method="get"
        className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter services and networks"
      >
        <label className="grid gap-2">
          Name
          <input
            name="q"
            defaultValue={query.get("q") ?? ""}
            className={STAFF_FIELD}
            maxLength={120}
          />
        </label>
        <label className="grid gap-2">
          Kind
          <select
            name="kind"
            defaultValue={query.get("kind") ?? ""}
            className={STAFF_FIELD}
          >
            <option value="">All networks</option>
            {NETWORK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {NETWORK_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <NetworkCountryFilter
          key={query.get("country")}
          initial={query.get("country") ?? ""}
          countries={data.countries ?? []}
          locked={basePath !== "/library-networks"}
        />
        {data.regions?.length ? (
          <label className="grid gap-2">
            Region
            <select
              name="region"
              defaultValue={query.get("region") ?? ""}
              className={STAFF_FIELD}
            >
              <option value="">All regions</option>
              {data.regions.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button type="submit" variant="primary">
          Find services
        </Button>
      </form>
      <p role="status">{data.total.toLocaleString()} services and networks</p>
      {!data.networks.length ? (
        <EmptyState
          message="No services found"
          detail="Try another name, country or kind. New public pages appear after editorial review."
        />
      ) : null}
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {data.networks.map((row) => (
          <li
            key={row.documentId}
            className="rounded-2xl border border-(--t-border-line) bg-white p-6"
          >
            <p className="text-xs font-semibold tracking-wide text-(--t-ink-dim) uppercase">
              {NETWORK_KIND_LABELS[row.kind]}
            </p>
            <h2 className="font-serif text-3xl">
              <Link href={networkHref(row.slug)}>{row.name}</Link>
            </h2>
            <p>
              {row.libraryCount.toLocaleString()} published libraries ·{" "}
              {row.countries.map((c) => c.name).join(", ")}
            </p>
            <p className="line-clamp-3 text-(--t-ink-dim)">{row.description}</p>
            <Link className={STAFF_LINK} href={networkHref(row.slug)}>
              Explore the network
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label="Directory pages" className="flex justify-between">
        {data.page > 1 ? (
          <Link className={STAFF_LINK} href={pageHref(data.page - 1)}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        {data.page * data.pageSize < data.total ? (
          <Link className={STAFF_LINK} href={pageHref(data.page + 1)}>
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
