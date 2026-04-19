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
        "group flex items-center gap-3 px-4 py-3.5 transition-[border-color,background-color] duration-300 hover:border-white/20 hover:bg-white/[0.07]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-cyan-50">
          {country.name}
        </p>
        {country.capitalCity ? (
          <p className="truncate text-xs text-white/40">
            {country.capitalCity}
          </p>
        ) : null}
      </div>

      <span className="flex-shrink-0 text-xs text-white/20 transition-colors group-hover:text-white/50">
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
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-[border-color,background-color] duration-200 outline-none placeholder:text-white/30 focus:border-white/25 focus:bg-white/[0.08]"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-lg text-white/30 transition-colors hover:text-white/60"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/30">
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
        <p className="mt-4 text-xs text-white/30">
          {filtered.length} of {countries.length} countries
        </p>
      ) : null}
    </div>
  )
}
