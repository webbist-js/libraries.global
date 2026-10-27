"use client"
import { useId, useState } from "react"

import { CountryCombobox } from "@/components/settings/CountryCombobox"

export function NetworkCountryFilter({
  initial,
  countries,
  locked = false,
}: {
  readonly initial: string
  readonly countries: readonly { slug: string; name: string }[]
  readonly locked?: boolean
}) {
  const [value, setValue] = useState(initial),
    id = useId()

  return (
    <div className="grid gap-2">
      <label id={`${id}-label`} htmlFor={id}>
        Country
      </label>
      <input type="hidden" name="country" value={value} />
      {locked ? (
        <p className="m-0 py-3">
          {countries.find((row) => row.slug === value)?.name ?? value}
        </p>
      ) : (
        <CountryCombobox
          id={id}
          labelledBy={`${id}-label`}
          value={value}
          onChange={setValue}
          countries={[
            { code: "", name: "All countries" },
            ...countries.map((row) => ({ code: row.slug, name: row.name })),
          ]}
        />
      )}
    </div>
  )
}
