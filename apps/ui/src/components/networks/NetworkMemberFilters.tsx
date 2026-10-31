import { FACILITY_CHECKLIST, networkHref } from "@repo/shared-data"
import Form from "next/form"

import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { analyticsAttributes } from "@/lib/analytics-events"
import { Link } from "@/lib/navigation"
import type { NetworkDetail } from "@/lib/networks/types"

export function NetworkMemberFilters({
  data,
  query,
}: {
  readonly data: NetworkDetail
  readonly query: URLSearchParams
}) {
  const selected = new Set(
    (query.get("facility") ?? "").split(",").filter(Boolean)
  )

  return (
    <Form
      action=""
      className="network-filter-card network-member-filters"
      aria-label="Filter member libraries"
      {...analyticsAttributes("search", {
        interaction_source: "network_members",
        search_type: "libraries",
      })}
    >
      <div className="network-member-filter-fields">
        <label className="grid gap-2 text-sm font-semibold">
          Library or town
          <input
            className={STAFF_FIELD}
            name="q"
            type="search"
            maxLength={120}
            defaultValue={query.get("q") ?? ""}
            placeholder="Search every member library"
          />
        </label>
        {(
          [
            ["country", "Country", data.facets?.countries],
            ["region", "Region", data.facets?.regions],
          ] as const
        ).map(([key, label, options]) =>
          options?.length ? (
            <label className="grid gap-2 text-sm font-semibold" key={key}>
              {label}
              <select
                name={key}
                className={STAFF_FIELD}
                defaultValue={query.get(key) ?? ""}
              >
                <option value="">
                  All {key === "country" ? "countries" : "regions"}
                </option>
                {options.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        )}
        <label className="grid gap-2 text-sm font-semibold">
          Library type
          <select
            className={STAFF_FIELD}
            name="type"
            defaultValue={query.get("type") ?? ""}
          >
            <option value="">All library types</option>
            {data.facets?.types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Sort by
          <select
            className={STAFF_FIELD}
            name="sort"
            defaultValue={query.get("sort") ?? "name"}
          >
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>
      <details
        className="network-facility-filters"
        open={Boolean(query.get("facility"))}
      >
        <summary>
          Accessibility and facilities{" "}
          <span>
            {selected.size === 0
              ? "Optional filters"
              : `${selected.size} selected`}
          </span>
        </summary>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">
            Facilities recorded as available
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {FACILITY_CHECKLIST.map((item) => (
              <label
                key={item.label}
                className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  name="facility"
                  type="checkbox"
                  value={item.label}
                  defaultChecked={selected.has(item.label)}
                  className="size-4 accent-(--t-accent-primary)"
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>
      </details>
      <p className="m-0 text-sm text-(--t-ink-dim)">
        Filters search the whole network. An unrecorded facility does not mean
        it is unavailable.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="pill">
          Apply filters
        </Button>
        <Link
          href={networkHref(data.network.slug)}
          className="network-page-link"
        >
          Clear filters
        </Link>
      </div>
    </Form>
  )
}
