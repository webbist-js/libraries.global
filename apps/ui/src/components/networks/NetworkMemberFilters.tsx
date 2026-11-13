import { FACILITY_CHECKLIST, networkHref } from "@repo/shared-data"
import Form from "next/form"
import { useTranslations } from "next-intl"

import { SelectField } from "@/components/ds/SelectField"
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const selected = new Set(
    (query.get("facility") ?? "").split(",").filter(Boolean)
  )

  return (
    <Form
      key={query.toString()}
      action=""
      className="network-filter-card network-member-filters"
      aria-label={tStatic("network.filter_member_libraries")}
      {...analyticsAttributes("search", {
        interaction_source: "network_members",
        search_type: "libraries",
      })}
    >
      <div className="network-member-filter-fields">
        <label className="grid gap-2 text-sm font-semibold">
          {tStatic("network.library_or_town")}
          <input
            className={STAFF_FIELD}
            name="q"
            type="search"
            maxLength={120}
            defaultValue={query.get("q") ?? ""}
            placeholder={tStatic("network.search_every_member_library")}
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
              <SelectField
                name={key}
                className={STAFF_FIELD}
                defaultValue={query.get(key) ?? ""}
                options={[
                  {
                    value: "",
                    label: String(
                      ["All", key === "country" ? "countries" : "regions"].join(
                        " "
                      )
                    ),
                  },
                  ...options.map((option) => ({
                    value: String(option.slug),
                    label: String(option.name),
                  })),
                ]}
              />
            </label>
          ) : null
        )}
        <label className="grid gap-2 text-sm font-semibold">
          {tExisting("ui.library_type")}
          <SelectField
            className={STAFF_FIELD}
            name="type"
            defaultValue={query.get("type") ?? ""}
            options={[
              { value: "", label: tStatic("network.all_library_types") },
              ...(data.facets?.types ?? []).map((type) => ({
                value: String(type),
                label: String(type),
              })),
            ]}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {tExisting("ui.sort_by")}
          <SelectField
            className={STAFF_FIELD}
            name="sort"
            defaultValue={query.get("sort") ?? "name"}
            options={[
              { value: "name", label: tStatic("network.name_a_z") },
              { value: "name-desc", label: tStatic("network.name_z_a") },
              { value: "updated", label: tStatic("network.recently_updated") },
            ]}
          />
        </label>
      </div>
      <details
        className="network-facility-filters"
        open={Boolean(query.get("facility"))}
      >
        <summary>
          {tExisting("ui.accessibility_and_facilities")}{" "}
          <span>
            {selected.size === 0
              ? "Optional filters"
              : `${selected.size} selected`}
          </span>
        </summary>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">
            {tStatic("network.facilities_recorded_as_available")}
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
        {tStatic(
          "network.filters_search_the_whole_network_an_unrecorded_facility_does_not_mean_it_is_unavailable"
        )}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="pill">
          {tStatic("network.apply_filters")}
        </Button>
        <Link
          href={networkHref(data.network.slug)}
          className="network-page-link"
        >
          {tExisting("ui.clear_filters")}
        </Link>
      </div>
    </Form>
  )
}
