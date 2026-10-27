import { facilityRows } from "@/components/library/facility-rows"
import { OpenCorrectionLink } from "@/components/library/LibraryCorrection"
import { LibraryFeatureDetails } from "@/components/library/LibraryFeatureDetails"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

export function LibraryAmenitiesSection({
  library,
  includeAmenities = true,
}: {
  readonly library: PopulatedLibraryData
  readonly includeAmenities?: boolean
}) {
  const rows = facilityRows(library)

  return (
    <>
      {(["amenity", "service"] as const).map((kind) => {
        if (kind === "amenity" && !includeAmenities) return null
        const group = rows.filter((row) => row.category === kind)
        const languages = kind === "service" ? library.languagesServed : null
        const classification =
          kind === "service" ? library.classificationSystem : null
        if (!group.length && !languages?.length && !classification) return null

        return (
          <LibrarySectionCard
            key={kind}
            id={kind === "amenity" ? "facilities" : "services"}
            title={kind === "amenity" ? "Facilities" : "Services"}
            iconPath={LIB_ICONS.book}
          >
            {kind === "service" ? (
              <>
                {group.some((row) => row.state === "yes") ? (
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {group
                      .filter((row) => row.state === "yes")
                      .map((row) => (
                        <li key={row.label}>
                          <span
                            className="inline-flex rounded-full px-3.5 py-2 text-base font-semibold"
                            style={{
                              background: T.bg.space,
                              color: T.ink.base,
                            }}
                          >
                            <LibraryFeatureDetails
                              name={row.label}
                              summary={row.summary}
                              description={row.description}
                              detailCategory={row.detailCategory}
                              className="inline-flex items-center gap-1.5 text-left"
                            />
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                    No services are documented yet.
                  </p>
                )}
                {(["no", "unknown"] as const).map((state) => {
                  const names = group
                    .filter((row) => row.state === state)
                    .map((row) => row.label)

                  return names.length ? (
                    <p
                      key={state}
                      className="mt-3 mb-0 text-sm leading-relaxed"
                      style={{ color: T.ink.dim }}
                    >
                      <span className="font-semibold">
                        {state === "no" ? "Not available" : "Not recorded"}:
                      </span>{" "}
                      {names.join(", ")}
                    </p>
                  ) : null
                })}
                <div
                  className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                  style={{ color: T.ink.dim }}
                >
                  {languages?.trim() || classification?.trim() ? (
                    <p className="m-0 leading-relaxed">
                      {languages?.trim()
                        ? `Languages served: ${languages.trim().replace(/\.+$/, "")}.`
                        : null}{" "}
                      {classification?.trim()
                        ? `Catalogue classified with ${classification.trim().replace(/\.+$/, "")}.`
                        : null}
                    </p>
                  ) : null}
                  <OpenCorrectionLink
                    category="Services and facilities"
                    className="inline-flex min-h-11 items-center text-sm underline underline-offset-[3px]"
                  >
                    Add a service
                  </OpenCorrectionLink>
                </div>
              </>
            ) : (
              <>
                <dl className="m-0 grid gap-3 sm:grid-cols-2">
                  {group.map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between gap-3 border-b py-2 text-sm"
                    >
                      <dt>
                        <LibraryFeatureDetails
                          name={row.label}
                          summary={row.summary}
                          description={row.description}
                          detailCategory={row.detailCategory}
                        />
                      </dt>
                      <dd className="m-0 font-semibold">
                        {row.state === "yes"
                          ? "Yes"
                          : row.state === "no"
                            ? "No"
                            : "Not recorded"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <OpenCorrectionLink
                  category="Services and facilities"
                  className="inline-flex min-h-11 items-center text-sm font-semibold underline"
                >
                  Suggest a correction
                </OpenCorrectionLink>
              </>
            )}
          </LibrarySectionCard>
        )
      })}
    </>
  )
}

export function LibraryAdditionalDetails({
  library,
}: {
  readonly library: PopulatedLibraryData
}) {
  const rec = library as unknown as Record<string, unknown>
  const fields = [
    { key: "operatorName", label: "Run by" },
    { key: "operatorType", label: "Operator type" },
    { key: "architect", label: "Architect" },
    { key: "buildingInfo", label: "Building" },
  ].filter((field) => typeof rec[field.key] === "string" && rec[field.key])
  if (!fields.length) return null

  return (
    <LibrarySectionCard
      id="building"
      title="About the library"
      iconPath={LIB_ICONS.building}
    >
      <dl className="m-0 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <dt className="text-sm font-semibold">{field.label}</dt>
            <dd className="m-0 mt-1 text-sm leading-relaxed">
              {String(rec[field.key])}
            </dd>
          </div>
        ))}
      </dl>
    </LibrarySectionCard>
  )
}
