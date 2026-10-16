"use client"

import {
  canonicalReaderCountry,
  parseArticleBrowseQuery,
  type ArticleBrowseResult,
  type ArticleFacetKey,
} from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  articleFacetMatches,
  articlePreviewParams,
  changeArticleFacet,
  clearArticleFacets,
} from "@/lib/article-filter-state"
import { articleLanguageOptions } from "@/lib/article-language-options"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { useRouter } from "@/lib/navigation"

const PREFERENCE_KEY = "libraries-global:article-country:v1"
const FACETS: ArticleFacetKey[] = [
  "languages",
  "continents",
  "countries",
  "regions",
  "areas",
  "sections",
  "topics",
  "libraries",
  "authors",
  "events",
]

export function ArticleDiscoveryFilters({
  discovery,
  kind,
}: {
  readonly discovery: ArticleBrowseResult
  readonly kind: "journal" | "knowledge"
}) {
  const params = useSearchParams()
  const encoded = params.toString()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("discovery")
  const p = useTranslations("publishing")
  const session = authClient.useSession()
  const readerId = session.data?.user?.id
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [staged, setStaged] = useState(encoded)
  const [search, setSearch] = useState("")
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [preferenceFailed, setPreferenceFailed] = useState(false)
  const [preview, setPreview] = useState<ArticleBrowseResult | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 639px)")
    if (!media) return
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener("change", update)

    return () => media.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    setStaged(encoded)
  }, [encoded])
  useEffect(() => {
    setSuggestion(null)
    if (new URLSearchParams(encoded).has("country")) return
    try {
      const saved = JSON.parse(
        localStorage.getItem(PREFERENCE_KEY) ?? "null"
      ) as { version?: number; countries?: string[] } | null
      const found =
        saved?.version === 1 && Array.isArray(saved.countries)
          ? saved.countries
              .map((value) =>
                canonicalReaderCountry(value, discovery.facets.countries)
              )
              .find(Boolean)
          : null
      if (found) {
        setSuggestion(found)

        return
      }
    } catch {
      /* Preference failures never change a public query. */
    }
    if (!readerId || session.isPending) return
    const controller = new AbortController()
    fetch("/api/profile/me", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((response: { data?: { country?: string } } | null) => {
        if (!controller.signal.aborted)
          setSuggestion(
            canonicalReaderCountry(
              response?.data?.country,
              discovery.facets.countries
            )
          )
      })
      .catch(() => {})

    return () => controller.abort()
  }, [encoded, discovery.facets.countries, readerId, session.isPending])
  useEffect(() => {
    setPreview(null)
    setPreviewFailed(false)
    if (!open || !mobile || staged === encoded) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(
        `/api/public-proxy/${kind === "journal" ? "blog" : "wiki"}-articles/browse?${articlePreviewParams(staged, kind, locale)}`,
        { signal: controller.signal, cache: "no-store" }
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Preview unavailable")

          return response.json() as Promise<ArticleBrowseResult>
        })
        .then((result) => {
          if (!controller.signal.aborted) setPreview(result)
        })
        .catch(() => {
          if (!controller.signal.aborted) setPreviewFailed(true)
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, mobile, staged, encoded, kind, locale])
  const current =
    mobile && open
      ? parseArticleBrowseQuery(Object.fromEntries(new URLSearchParams(staged)))
          .filters
      : discovery.appliedFilters
  const resolved = preview ?? discovery
  const keys = FACETS.filter(
    (key) => kind === "journal" || (key !== "authors" && key !== "events")
  )
  const chips = keys.flatMap((key) =>
    (discovery.appliedFilters[key] ?? []).map((value) => ({
      key,
      value,
      label:
        key === "languages"
          ? languageName(value, [], locale)
          : (discovery.facets[key].find((facet) =>
              articleFacetMatches(facet, value)
            )?.label ?? value),
    }))
  )
  function navigate(next: URLSearchParams) {
    if (next.has("country"))
      try {
        localStorage.setItem(
          PREFERENCE_KEY,
          JSON.stringify({
            version: 1,
            countries:
              parseArticleBrowseQuery(Object.fromEntries(next)).filters
                .countries ?? [],
          })
        )
      } catch {
        setPreferenceFailed(true)
      }
    startTransition(() => router.push(`/${kind}?${next}`, { scroll: false }))
  }
  function choose(key: ArticleFacetKey, values: string[]) {
    const next = changeArticleFacet(
      mobile && open ? staged : encoded,
      key,
      values,
      resolved.facets
    )
    if (mobile && open) setStaged(next.toString())
    else navigate(next)
  }
  const languageValues = articleLanguageOptions(
    resolved.facets.languages.map((facet) => facet.value),
    current.languages ?? []
  ).map(
    (value) =>
      resolved.facets.languages.find((facet) => facet.value === value) ?? {
        value,
        label: value,
        count: 0,
      }
  )
  const changingPreview = mobile && staged !== encoded && !preview

  return (
    <div aria-busy={pending} className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        {kind === "journal" && (
          <div
            role="group"
            aria-label={t("origins")}
            className="inline-flex rounded-full border p-1"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            {[
              ["community", t("communityJournal")],
              ["index", t("fromIndex")],
              ["all", t("allStories")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={
                  (discovery.appliedFilters.origins?.[0] ?? "all") === value
                }
                onClick={() =>
                  choose("origins", value === "all" ? [] : [value!])
                }
                className="rounded-full px-3 py-2 text-sm font-semibold"
                style={{
                  background:
                    (discovery.appliedFilters.origins?.[0] ?? "all") === value
                      ? T.ink.base
                      : undefined,
                  color:
                    (discovery.appliedFilters.origins?.[0] ?? "all") === value
                      ? T.bg.deep
                      : T.ink.base,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value)
            if (value) {
              setStaged(encoded)
              setSearch("")
            }
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: T.border.hi }}
            >
              {p("filters")}
              {chips.length ? ` · ${chips.length}` : ""}
            </button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-3xl"
            style={{ background: T.bg.deep, color: T.ink.base }}
          >
            <DialogTitle>{p("filters")}</DialogTitle>
            <DialogDescription>{p("filterLogic")}</DialogDescription>
            <div className="flex flex-wrap items-center gap-3">
              <label className="grow">
                <span className="sr-only">{p("findFilter")}</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={p("findFilter")}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </label>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => {
                  const next = clearArticleFacets(mobile ? staged : encoded)
                  if (mobile) setStaged(next.toString())
                  else navigate(next)
                }}
              >
                {p("clearFilters")}
              </button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {keys.map((key) => {
                const choices = (
                  key === "languages" ? languageValues : resolved.facets[key]
                ).filter((facet) =>
                  `${key === "languages" ? languageName(facet.value, [], locale) : facet.label}`
                    .toLocaleLowerCase(locale)
                    .includes(search.toLocaleLowerCase(locale))
                )
                if (!choices.length && !current[key]?.length) return null

                return (
                  <fieldset
                    key={key}
                    className="min-w-0 rounded-2xl border p-4"
                  >
                    <legend className="px-1 text-sm font-semibold">
                      {t(key)}
                    </legend>
                    {(key === "languages" || key === "countries") && (
                      <button
                        type="button"
                        className="mb-2 text-sm underline"
                        onClick={() => choose(key, [])}
                      >
                        {t(
                          key === "languages" ? "allLanguages" : "allCountries"
                        )}
                      </button>
                    )}
                    {key === "languages" && (
                      <p className="mt-0 text-xs" style={{ color: T.ink.dim }}>
                        {p("contentLanguageHint")}
                      </p>
                    )}
                    <div className="max-h-52 overflow-y-auto">
                      {choices.map((facet) => {
                        const checked = (current[key] ?? []).some((value) =>
                          articleFacetMatches(facet, value)
                        )

                        return (
                          <label
                            key={facet.value}
                            className="flex items-start justify-between gap-3 py-1.5 text-sm"
                          >
                            <span className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={pending}
                                onChange={() =>
                                  choose(
                                    key,
                                    checked
                                      ? (current[key] ?? []).filter(
                                          (value) =>
                                            !articleFacetMatches(facet, value)
                                        )
                                      : [...(current[key] ?? []), facet.value]
                                  )
                                }
                              />
                              <span>
                                {key === "languages"
                                  ? languageName(facet.value, [], locale)
                                  : facet.label}
                              </span>
                            </span>
                            {!changingPreview && (
                              <span style={{ color: T.ink.dim }}>
                                ({facet.count})
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>
            {previewFailed && <p role="status">{p("countUnavailable")}</p>}
            <button
              type="button"
              onClick={() => {
                if (mobile) navigate(new URLSearchParams(staged))
                setOpen(false)
              }}
              className="rounded-full px-4 py-3 font-semibold"
              style={{ background: T.accent.primary, color: T.bg.deep }}
            >
              {changingPreview
                ? p("showResults")
                : p("showCount", { count: resolved.total })}
            </button>
          </DialogContent>
        </Dialog>
        {suggestion && !params.has("country") && (
          <button
            className="text-sm underline"
            type="button"
            onClick={() => choose("countries", [suggestion])}
          >
            {t("countrySuggestion", {
              country:
                discovery.facets.countries.find(
                  (facet) => facet.value === suggestion
                )?.label ?? suggestion,
            })}
          </button>
        )}
      </div>
      {chips.length > 0 ? (
        <ul
          aria-label={t("selectedFilters")}
          className="mt-3 flex list-none flex-wrap gap-2 p-0"
        >
          {chips.map(({ key, value, label }) => (
            <li key={`${key}:${value}`}>
              <button
                type="button"
                aria-label={t("removeFilter", { facet: t(key), value: label })}
                onClick={() =>
                  choose(
                    key,
                    (discovery.appliedFilters[key] ?? []).filter(
                      (entry) => entry !== value
                    )
                  )
                }
                className="rounded-full px-3 py-1 text-sm"
                style={{
                  background: T.accent.chip,
                  color: T.accent.primaryHover,
                }}
              >
                {label} ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-0 text-xs" style={{ color: T.ink.dim }}>
          {t("worldwide")}
        </p>
      )}
      {preferenceFailed && (
        <p role="status" className="text-sm">
          {t("preferenceFailed")}
        </p>
      )}
    </div>
  )
}
