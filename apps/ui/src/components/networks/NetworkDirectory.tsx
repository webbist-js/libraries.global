import {
  NETWORK_KINDS,
  NETWORK_KIND_LABELS,
  networkHref,
} from "@repo/shared-data"
import Form from "next/form"
import { useTranslations } from "next-intl"

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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
        aria-label={tStatic("network.filter_services_and_networks")}
        {...analyticsAttributes("search", {
          interaction_source: "network_directory",
          search_type: "networks",
        })}
      >
        <label className="grid gap-2">
          {tExisting("ui.name")}
          <input
            type="search"
            placeholder={tStatic("network.service_or_university_name")}
            name="q"
            defaultValue={query.get("q") ?? ""}
            className={`${STAFF_FIELD} h-12`}
            maxLength={120}
          />
        </label>
        <label className="grid gap-2">
          {tStatic("common.kind")}
          <SelectField
            name="kind"
            defaultValue={query.get("kind") ?? ""}
            className={`${STAFF_FIELD} h-12`}
            options={[
              { value: "", label: tExisting("atlasNetwork.allNetworks") },
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
            {tExisting("discovery.regions")}
            <SelectField
              name="region"
              defaultValue={query.get("region") ?? ""}
              className={`${STAFF_FIELD} h-12`}
              options={[
                { value: "", label: tExisting("atlasNetwork.allRegions") },
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
          {tStatic("network.find_services")}
        </Button>
        <Link className="network-page-link" href={basePath}>
          {tExisting("ui.clear_filters")}
        </Link>
      </Form>
      <details className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          {tStatic("network.how_to_use_this_directory")}
        </summary>
        <p className="mt-3 mb-0 max-w-[72ch] text-(--t-ink-dim)">
          {tStatic(
            "network.explore_library_services_university_systems_and_consortia_each_page_lists_its_published_member_libra"
          )}
        </p>
        <dl className="mt-5 mb-0 grid gap-x-10 gap-y-5 border-t border-(--t-border-line) pt-5 sm:grid-cols-2">
          <div>
            <dt className="mb-1 font-semibold">{tExisting("ui.name")}</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              {tStatic(
                "network.search_for_all_or_part_of_a_service_university_system_or_consortium_name"
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-semibold">{tStatic("common.kind")}</dt>
            <dd className="m-0 text-(--t-ink-dim)">
              {tStatic(
                "network.choose_a_public_library_service_a_university_system_or_a_consortium_connecting_institutions"
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-semibold">
              {tStatic("network.country_and_region")}
            </dt>
            <dd className="m-0 text-(--t-ink-dim)">
              {tStatic(
                "network.narrow_the_directory_geographically_country_pages_keep_their_country_selected_regions_appear_where_a"
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-semibold">
              {tStatic("network.find_services_and_clear_filters")}
            </dt>
            <dd className="m-0 text-(--t-ink-dim)">
              {tStatic(
                "network.apply_your_chosen_filters_or_reset_them_to_browse_again_results_link_to_member_libraries_maps_and_so"
              )}
            </dd>
          </div>
        </dl>
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
              {tStatic("network.explore_the_atlas")}
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
              {tStatic("network.explore_the_network")}
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
        label={tStatic("network.directory_pages")}
      />
    </div>
  )
}
