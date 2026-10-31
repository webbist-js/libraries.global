import { publicSourceUrl, type LibrarySourceRecord } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { fieldLabel } from "@/components/library/change-history.helpers"
import { T } from "@/lib/design-tokens"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"

const SOURCE_NAMES: Record<string, string> = {
  libraryon: "LibraryOn",
  wikidata: "Wikidata",
  manual: "A contributor",
}

function sourceLicence(credit: DatasetRecord | undefined, showCredit: boolean) {
  if (!showCredit || !credit?.licence) return null
  const href = publicSourceUrl(credit.licenceUrl)
  if (!href) return credit.licence

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {credit.licence}
    </a>
  )
}

function SourceAttribution({
  showCredit,
  credit,
  licence,
}: {
  showCredit: boolean
  credit?: DatasetRecord
  licence: ReactNode
}) {
  if (!showCredit) return null
  if (credit?.attribution)
    return (
      <p
        className="m-0 mt-1 text-sm leading-normal"
        style={{ color: T.ink.dim }}
      >
        {credit.attribution}
      </p>
    )
  if (!credit?.publisher && !licence) return null

  return (
    <p className="m-0 mt-1 text-sm" style={{ color: T.ink.dim }}>
      {credit?.publisher}
      {credit?.publisher && licence ? " · " : null}
      {licence}
    </p>
  )
}

function SourceDetails({
  reference,
  retrieved,
  supportedFields,
  licence,
  showLicence,
}: {
  reference: LibrarySourceRecord
  retrieved: string | null
  supportedFields: string[]
  licence: ReactNode
  showLicence: boolean
}) {
  const tUi = useUiTranslations("ui")

  return (
    <details className="mt-1.5 text-sm" style={{ color: T.ink.dim }}>
      <summary className="w-fit cursor-pointer underline underline-offset-2">
        {tUi("history_source_details")}
      </summary>
      <dl className="m-0 mt-2 grid gap-1">
        {showLicence ? (
          <div className="flex flex-wrap gap-x-2">
            <dt>{tUi("history_source_licence")}</dt>
            <dd className="m-0">{licence}</dd>
          </div>
        ) : null}
        {reference.recordId ? (
          <div className="flex flex-wrap gap-x-2">
            <dt>{tUi("history_source_record_id")}</dt>
            <dd className="m-0 break-all">{reference.recordId}</dd>
          </div>
        ) : null}
        {retrieved ? (
          <div className="flex flex-wrap gap-x-2">
            <dt>{tUi("history_source_retrieved")}</dt>
            <dd className="m-0">{retrieved}</dd>
          </div>
        ) : null}
        {supportedFields.length ? (
          <div className="flex flex-wrap gap-x-2">
            <dt>{tUi("history_source_supports")}</dt>
            <dd className="m-0">
              {supportedFields.map(fieldLabel).join(", ")}
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  )
}

/** Source provenance stays readable while identifiers and field coverage remain available on demand. */
export function LibrarySourceCredits({
  references,
  datasets,
  added,
  formatDate,
}: {
  readonly references: readonly LibrarySourceRecord[]
  readonly datasets: readonly DatasetRecord[]
  readonly added: string | null
  readonly formatDate: (value: string | null | undefined) => string | null
}) {
  const tUi = useUiTranslations("ui")
  const datasetByKey = new Map(
    datasets.map((dataset) => [dataset.key, dataset])
  )
  const creditedDatasets = new Set<string>()

  return (
    <div className="library-source-credits">
      {references.length ? (
        <ul className="m-0 grid list-none divide-y divide-(--t-border-line) p-0">
          {references.map((reference, index) => {
            const credit = reference.dataset
              ? datasetByKey.get(reference.dataset)
              : undefined
            const showCredit = Boolean(
              credit && !creditedDatasets.has(credit.key)
            )
            if (credit) creditedDatasets.add(credit.key)
            const url =
              publicSourceUrl(reference.url) ??
              publicSourceUrl(credit?.sourceUrl)
            const title =
              reference.label ||
              credit?.name ||
              (reference.dataset
                ? (SOURCE_NAMES[reference.dataset] ?? reference.dataset)
                : null) ||
              url ||
              tUi("history_source_reference")
            const retrieved = formatDate(reference.retrievedAt)
            const licence = sourceLicence(credit, showCredit)
            const supportedFields = Array.isArray(reference.fields)
              ? reference.fields.filter((field) => typeof field === "string")
              : []
            const details = Boolean(
              reference.recordId ||
              retrieved ||
              supportedFields.length ||
              (showCredit && credit?.attribution && licence)
            )

            return (
              // eslint-disable-next-line react/no-array-index-key -- Source citations are read-only snapshots; repeated references retain their published order.
              <li key={index} className="min-w-0 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p
                    className="m-0 min-w-0 text-sm leading-relaxed font-semibold break-words"
                    style={{ color: T.ink.base }}
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words text-(--t-accent-primary) underline underline-offset-[3px]"
                      >
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                  </p>
                  {index === 0 && added ? (
                    <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                      {added}
                    </p>
                  ) : null}
                </div>
                <SourceAttribution
                  showCredit={showCredit}
                  credit={credit}
                  licence={licence}
                />
                {details ? (
                  <SourceDetails
                    reference={reference}
                    retrieved={retrieved}
                    supportedFields={supportedFields}
                    licence={licence}
                    showLicence={Boolean(
                      showCredit && credit?.attribution && licence
                    )}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {[added, tUi("history_source_missing")].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  )
}
