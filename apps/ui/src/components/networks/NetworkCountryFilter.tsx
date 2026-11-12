import { useTranslations } from "next-intl"

import { SelectField } from "@/components/ds/SelectField"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"

export function NetworkCountryFilter({
  initial,
  countries,
  locked = false,
}: {
  readonly initial: string
  readonly countries: readonly { slug: string; name: string }[]
  readonly locked?: boolean
}) {
  const tExisting = useTranslations()

  return (
    <label className="grid gap-2">
      {tExisting("ui.country")}
      {locked ? (
        <>
          <input type="hidden" name="country" value={initial} />
          <span className={`${STAFF_FIELD} h-12`}>
            {countries.find((row) => row.slug === initial)?.name ?? initial}
          </span>
        </>
      ) : (
        <SelectField
          name="country"
          defaultValue={initial}
          className={`${STAFF_FIELD} h-12`}
          options={[
            { value: "", label: tExisting("atlasNetwork.allCountries") },
            ...countries.map((row) => ({
              value: String(row.slug),
              label: String(row.name),
            })),
          ]}
        />
      )}
    </label>
  )
}
