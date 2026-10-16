"use client"

import {
  ARTICLE_QUERY_KEYS,
  canonicalReaderCountry,
  type ArticleBrowseResult,
  type ArticleFacetKey,
} from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"

import { articleLanguageOptions } from "@/lib/article-language-options"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { useRouter } from "@/lib/navigation"

const KEYS = [
  "continents",
  "countries",
  "regions",
  "areas",
  "libraries",
  "topics",
  "authors",
  "events",
] as const
const PREFERENCE_KEY = "libraries-global:article-country:v1"

/** Personal defaults live in the reader's browser; cached CMS results stay public. */
export function ArticleDiscoveryFilters({
  discovery,
  kind,
}: {
  readonly discovery: ArticleBrowseResult
  readonly kind: "journal" | "knowledge"
}) {
  const params = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("discovery")
  const session = authClient.useSession()
  const [pending, startTransition] = useTransition()
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [preferenceFailed, setPreferenceFailed] = useState(false)
  const encoded = params.toString()
  const readerId = session.data?.user?.id

  function go(key: ArticleFacetKey, values: string[]) {
    const next = new URLSearchParams(encoded)
    next.delete("page")
    const name = ARTICLE_QUERY_KEYS[key]
    if (values.length) next.set(name, values.join(","))
    else if (key === "countries" || key === "languages" || key === "origins")
      next.set(name, "all")
    else next.delete(name)
    // Parent changes clear child geography instead of leaving incompatible filters.
    if (key === "continents") {
      next.set("country", "all")
      next.delete("region")
      next.delete("area")
    }
    if (key === "countries") {
      next.delete("region")
      next.delete("area")
    }
    if (key === "regions") next.delete("area")
    if (key === "countries") {
      try {
        localStorage.setItem(
          PREFERENCE_KEY,
          JSON.stringify({ version: 1, countries: values })
        )
      } catch {
        setPreferenceFailed(true)
      }
    }
    startTransition(() =>
      router.push(`/${kind}?${next.toString()}`, { scroll: false })
    )
  }

  useEffect(() => {
    // An explicit URL (including country=all) always wins over preferences.
    if (new URLSearchParams(encoded).has("country")) return
    try {
      const saved = JSON.parse(
        localStorage.getItem(PREFERENCE_KEY) ?? "null"
      ) as { version?: number; countries?: unknown } | null
      if (saved?.version === 1 && Array.isArray(saved.countries)) {
        const countries = saved.countries
          .filter((value): value is string => typeof value === "string")
          .map((value) =>
            canonicalReaderCountry(value, discovery.facets.countries)
          )
          .filter((value): value is string => !!value)
        const next = new URLSearchParams(encoded)
        next.set("country", countries.length ? countries.join(",") : "all")
        next.delete("page")
        router.replace(`/${kind}?${next.toString()}`, { scroll: false })

        return
      }
    } catch {
      /* Browsing remains usable when browser storage is unavailable. */
    }
    if (!readerId) return
    const controller = new AbortController()
    fetch("/api/profile/me", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((response: { data?: { country?: string } } | null) => {
        setSuggestion(
          canonicalReaderCountry(
            response?.data?.country,
            discovery.facets.countries
          )
        )
      })
      .catch(() => {})

    return () => controller.abort()
  }, [encoded, discovery.facets.countries, kind, router, readerId])

  const selected = discovery.appliedFilters
  const languageFacets: ArticleBrowseResult["facets"]["languages"] =
    articleLanguageOptions(
      discovery.facets.languages.map((facet) => facet.value),
      selected.languages ?? []
    ).map(
      (value) =>
        discovery.facets.languages.find((facet) => facet.value === value) ?? {
          value,
          label: value,
          count: 0,
        }
    )
  const keys: ArticleFacetKey[] =
    kind === "knowledge"
      ? [
          "languages",
          ...KEYS.filter((key) => key !== "authors" && key !== "events"),
        ]
      : ["languages", ...KEYS]
  const chips = keys.flatMap((key) =>
    (selected[key] ?? []).map((value) => ({
      key,
      value,
      label:
        discovery.facets[key].find(
          (facet) =>
            facet.value === value ||
            facet.slug === value ||
            facet.code === value
        )?.label ?? value,
    }))
  )

  return (
    <div
      aria-busy={pending}
      className="mt-5 rounded-2xl border p-4"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <div className="flex flex-wrap items-start gap-3">
        {kind === "journal" ? (
          <label className="text-sm">
            <span className="mb-1 block font-semibold">{t("origins")}</span>
            <select
              className="rounded-lg border p-2"
              disabled={pending}
              onChange={(event) =>
                go(
                  "origins",
                  event.target.value === "all" ? [] : [event.target.value]
                )
              }
              value={selected.origins?.[0] ?? "all"}
            >
              <option value="community">{t("communityJournal")}</option>
              <option value="index">{t("fromIndex")}</option>
              <option value="all">{t("allStories")}</option>
            </select>
          </label>
        ) : null}
        {keys.map((key) =>
          discovery.facets[key].length || selected[key]?.length ? (
            <details
              className="min-w-32 rounded-lg border px-3 py-2 text-sm"
              key={key}
              style={{ borderColor: T.border.hi }}
            >
              <summary className="cursor-pointer font-semibold">
                {t(key)}{" "}
                {selected[key]?.length ? `(${selected[key]?.length})` : ""}
              </summary>
              <div className="mt-2 max-h-56 overflow-auto">
                {key === "countries" || key === "languages" ? (
                  <button
                    className="mb-2 block underline"
                    onClick={() => go(key, [])}
                    type="button"
                  >
                    {t(key === "countries" ? "allCountries" : "allLanguages")}
                  </button>
                ) : null}
                {(key === "languages"
                  ? languageFacets
                  : discovery.facets[key]
                ).map((facet) => {
                  const checked = (selected[key] ?? []).some(
                    (value) =>
                      value === facet.value ||
                      value === facet.slug ||
                      value === facet.code
                  )

                  return (
                    <label
                      className="flex items-start gap-2 py-1"
                      key={facet.value}
                    >
                      <input
                        checked={checked}
                        disabled={pending}
                        onChange={() =>
                          go(
                            key,
                            checked
                              ? (selected[key] ?? []).filter(
                                  (value) =>
                                    value !== facet.value &&
                                    value !== facet.slug &&
                                    value !== facet.code
                                )
                              : [...(selected[key] ?? []), facet.value]
                          )
                        }
                        type="checkbox"
                      />
                      <span>
                        {key === "languages"
                          ? languageName(facet.value, [], locale)
                          : facet.label}{" "}
                        <span style={{ color: T.ink.dim }}>
                          ({facet.count})
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </details>
          ) : null
        )}
        <button
          className="self-center text-sm underline"
          onClick={() => go("countries", [])}
          type="button"
        >
          {t("allCountries")}
        </button>
      </div>
      {chips.length ? (
        <ul
          aria-label={t("selectedFilters")}
          className="mt-3 flex list-none flex-wrap gap-2 p-0"
        >
          {chips.map(({ key, value, label }) => (
            <li key={`${key}:${value}`}>
              <button
                aria-label={t("removeFilter", { facet: t(key), value: label })}
                className="rounded-full px-3 py-1 text-sm"
                onClick={() =>
                  go(
                    key,
                    (selected[key] ?? []).filter((entry) => entry !== value)
                  )
                }
                style={{
                  background: T.accent.chip,
                  color: T.accent.primaryHover,
                }}
                type="button"
              >
                {label} ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 mb-0 text-sm" style={{ color: T.ink.dim }}>
          {t("worldwide")}
        </p>
      )}
      {suggestion && !params.has("country") ? (
        <button
          className="mt-3 text-sm underline"
          onClick={() => go("countries", [suggestion])}
          type="button"
        >
          {t("countrySuggestion", {
            country:
              discovery.facets.countries.find(
                (facet) => facet.value === suggestion
              )?.label ?? suggestion,
          })}
        </button>
      ) : null}
      {preferenceFailed ? (
        <p className="mt-2 mb-0 text-sm">{t("preferenceFailed")}</p>
      ) : null}
    </div>
  )
}
