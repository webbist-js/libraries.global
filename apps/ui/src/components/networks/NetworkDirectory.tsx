import {
  NETWORK_KINDS,
  NETWORK_KIND_LABELS,
  networkHref,
} from "@repo/shared-data"
import Form from "next/form"

import { EmptyState } from "@/components/ds/EmptyState"
import { DirectoryPagination } from "@/components/networks/DirectoryPagination"
import { NetworkCountryFilter } from "@/components/networks/NetworkCountryFilter"
import { SearchResultsAnalytics } from "@/components/providers/SearchResultsAnalytics"
import { STAFF_FIELD, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { analyticsAttributes } from "@/lib/analytics-events"
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
  return (
    <div className="space-y-8">
      <SearchResultsAnalytics
        source="network_directory"
        searchType="networks"
        searchKey={query.get("q")?.trim() ? query.toString() : ""}
        count={data.total}
      />
      <Form
        action=""
        className="network-filter-card grid items-end gap-4 sm:grid-cols-2 @min-[900px]:grid-cols-4"
        aria-label="Filter services and networks"
        {...analyticsAttributes("search", {
          interaction_source: "network_directory",
          search_type: "networks",
        })}
      >
        <label className="grid gap-2">
          Name
          <input
            type="search"
            placeholder="Service or university name"
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
        <Link className="network-page-link" href={basePath}>
          Clear filters
        </Link>
      </Form>
      <p role="status">{data.total.toLocaleString()} services and networks</p>
      {!data.networks.length ? (
        <EmptyState
          message="No services found"
          detail="Try another name, country or kind. New public pages appear after editorial review."
        />
      ) : null}
      <ul className="network-directory-grid m-0 grid list-none gap-4 p-0">
        {data.networks.map((row) => (
          <li key={row.documentId} className="network-member-card">
            <p className="text-xs font-semibold tracking-wide text-(--t-ink-dim) uppercase">
              {NETWORK_KIND_LABELS[row.kind]}
            </p>
            <h2 className="type-h3 mt-2 mb-0">
              <Link
                href={networkHref(row.slug)}
                {...analyticsAttributes("select_content", {
                  interaction_source: "network_directory",
                  content_type: "network",
                  content_id: row.documentId,
                })}
              >
                {row.name}
              </Link>
            </h2>
            <p className="text-sm text-(--t-ink-dim)">
              {row.libraryCount.toLocaleString()} published libraries ·{" "}
              {row.countries.map((c) => c.name).join(", ")}
            </p>
            <p className="line-clamp-3 text-sm leading-relaxed text-(--t-ink-dim)">
              {row.description}
            </p>
            <Link
              className={`${STAFF_LINK} mt-auto pt-4`}
              href={networkHref(row.slug)}
              {...analyticsAttributes("select_content", {
                interaction_source: "network_directory",
                content_type: "network",
                content_id: row.documentId,
              })}
            >
              Explore the network
            </Link>
          </li>
        ))}
      </ul>
      <DirectoryPagination
        basePath={basePath}
        query={query}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        label="Directory pages"
      />
    </div>
  )
}
