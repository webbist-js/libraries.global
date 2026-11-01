import {
  NETWORK_KINDS,
  NETWORK_KIND_LABELS,
  networkHref,
} from "@repo/shared-data"
import Form from "next/form"

import { EmptyState } from "@/components/ds/EmptyState"
import { SelectField } from "@/components/ds/SelectField"
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
  const hasFilters = ["q", "kind", "country", "region"].some((key) =>
    Boolean(query.get(key))
  )

  return (
    <div className="space-y-8">
      <SearchResultsAnalytics
        source="network_directory"
        searchType="networks"
        searchKey={query.get("q")?.trim() ? query.toString() : ""}
        count={data.total}
      />
      <Form
        key={query.toString()}
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
            className={`${STAFF_FIELD} h-12`}
            maxLength={120}
          />
        </label>
        <label className="grid gap-2">
          Kind
          <SelectField
            name="kind"
            defaultValue={query.get("kind") ?? ""}
            className={`${STAFF_FIELD} h-12`}
            options={[
              { value: "", label: "All networks" },
              ...NETWORK_KINDS.map((kind) => ({
                value: String(kind),
                label: String(NETWORK_KIND_LABELS[kind]),
              })),
            ]}
          />
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
            <SelectField
              name="region"
              defaultValue={query.get("region") ?? ""}
              className={`${STAFF_FIELD} h-12`}
              options={[
                { value: "", label: "All regions" },
                ...data.regions.map((row) => ({
                  value: String(row.slug),
                  label: String(row.name),
                })),
              ]}
            />
          </label>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          size="pill"
          className="h-12 min-h-12 py-2.5"
        >
          Find services
        </Button>
        <Link className="network-page-link" href={basePath}>
          Clear filters
        </Link>
      </Form>
      <details className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          How to use this directory
        </summary>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Name</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              Search for all or part of a service, university system or
              consortium name.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Kind</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              Choose a public library service, a university system or a
              consortium connecting institutions.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Country and region</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              Narrow the directory geographically. Country pages keep their
              country selected; regions appear where available.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Find services and clear filters</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              Apply your chosen filters, or reset them to browse again. Results
              link to member libraries, maps and source information; pagination
              shows more matches.
            </dd>
          </div>
        </dl>
        <p className="mb-0 text-(--t-ink-dim)">
          Explore library services, university systems and consortia. Each page
          lists its published member libraries and available source information.
        </p>
      </details>
      <p role="status">{data.total.toLocaleString()} services and networks</p>
      {!data.networks.length ? (
        <EmptyState
          message={
            hasFilters
              ? "No matching services"
              : "No services and networks listed yet"
          }
          detail={
            hasFilters
              ? "Try another name, country or kind, or clear the filters."
              : "Explore the Atlas to find libraries while this directory grows."
          }
          action={
            <Link href="/map" className="network-page-link">
              Explore the Atlas
            </Link>
          }
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
