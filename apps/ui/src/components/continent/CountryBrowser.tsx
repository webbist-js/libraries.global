"use client"

import { useMemo, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { cn } from "@/lib/styles"

export type CountrySummary = {
  name: string
  slug: string
  capitalCity?: string | null
}

function CountryCard({
  country,
  continentSlug,
}: {
  country: CountrySummary
  continentSlug: string
}) {
  return (
    <GlobalLink
      href={`/${continentSlug}/${country.slug}`}
      className={cn(
        homepagePanelClassName,
        "group flex items-center gap-3 px-4 py-3.5 transition-[border-color,background-color] duration-300 hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-(--t-ink-base) transition-colors group-hover:text-(--t-accent-aurora)">
          {country.name}
        </p>
        {country.capitalCity ? (
          <p className="truncate text-xs text-(--t-ink-faint)">
            {country.capitalCity}
          </p>
        ) : null}
      </div>

      <span className="flex-shrink-0 text-xs text-(--t-ink-faint) transition-colors group-hover:text-(--t-ink-dim)">
        →
      </span>
    </GlobalLink>
  )
}

export function CountryBrowser({
  countries,
  continentSlug,
}: {
  countries: CountrySummary[]
  continentSlug: string
}) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries

    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.capitalCity?.toLowerCase().includes(q) ?? false)
    )
  }, [countries, query])

  const showSearch = countries.length > 8

  return (
    <div>
      {showSearch ? (
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${countries.length} countries…`}
            className="w-full rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-2.5 text-sm text-(--t-ink-base) transition-[border-color,background-color] duration-200 outline-none placeholder:text-(--t-ink-faint) focus:border-(--t-border-hi) focus:bg-(--t-bg-deep)"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-lg text-(--t-ink-faint) transition-colors hover:text-(--t-ink-dim)"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-(--t-ink-faint)">
          No countries match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((country) => (
            <CountryCard
              key={country.slug}
              country={country}
              continentSlug={continentSlug}
            />
          ))}
        </div>
      )}

      {query && filtered.length > 0 ? (
        <p className="mt-4 text-xs text-(--t-ink-faint)">
          {filtered.length} of {countries.length} countries
        </p>
      ) : null}
    </div>
  )
}
