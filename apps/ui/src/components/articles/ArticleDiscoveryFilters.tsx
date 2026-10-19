"use client"

import { Icon } from "@iconify/react"
import {
  canonicalReaderCountry,
  parseArticleBrowseQuery,
  type ArticleBrowseResult,
  type ArticleFacetKey,
} from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"

import { SearchField } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
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
  knowledgeBrowseParams,
} from "@/lib/article-filter-state"
import { articleLanguageOptions } from "@/lib/article-language-options"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { useRouter } from "@/lib/navigation"

const FACET_ICONS: Partial<Record<ArticleFacetKey, string>> = {
  languages: "mdi:translate",
  continents: "mdi:earth",
  countries: "mdi:flag-outline",
  regions: "mdi:map-outline",
  areas: "mdi:map-marker-outline",
  sections: "mdi:bookshelf",
  libraries: "mdi:library-outline",
  topics: "mdi:tag-outline",
  authors: "mdi:account-outline",
  events: "mdi:calendar-outline",
}

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
  compact = false,
}: {
  readonly discovery: ArticleBrowseResult
  readonly kind: "journal" | "knowledge"
  readonly compact?: boolean
}) {
  const params = useSearchParams()
  const encoded = params.toString()
  const router = useRouter()
  const locale = useLocale()
  const defaultLanguage = discovery.appliedFilters.languages?.[0] ?? locale
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
        `/api/public-proxy/api/${kind === "journal" ? "blog" : "wiki"}-articles/browse?${articlePreviewParams(staged, kind, locale, defaultLanguage)}`,
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
  }, [open, mobile, staged, encoded, kind, locale, defaultLanguage])
  const current =
    mobile && open
      ? parseArticleBrowseQuery(
          kind === "knowledge"
            ? Object.fromEntries(
                new URLSearchParams(
                  knowledgeBrowseParams(
                    locale,
                    Object.fromEntries(new URLSearchParams(staged)),
                    defaultLanguage
                  )
                )
              )
            : Object.fromEntries(new URLSearchParams(staged))
        ).filters
      : discovery.appliedFilters
  const resolved = preview ?? discovery
  const keys = FACETS.filter(
    (key) => kind === "journal" || (key !== "authors" && key !== "events")
  )
  const chips = keys
    .filter(
      (key) =>
        key !== "origins" &&
        (!compact ||
          ((key !== "sections" || kind === "journal") && key !== "languages"))
    )
    .flatMap((key) =>
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
  function facetLabel(
    key: ArticleFacetKey,
    facet: { value: string; label: string }
  ) {
    if (key === "languages") return languageName(facet.value, [], locale)
    if (key === "sections")
      return (
        discovery.facets.sections.find((entry) => entry.value === facet.value)
          ?.label ?? facet.label
      )

    return facet.label
  }

  const countrySuggestion =
    suggestion && !params.has("country") ? (
      <button
        className="min-h-11 cursor-pointer rounded-full px-3 text-sm font-semibold text-(--t-accent-primary) hover:bg-(--t-accent-chip)"
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
    ) : null

  return (
    <div
      aria-busy={pending}
      className={
        compact
          ? "shrink-0 border-t border-(--t-divider) py-[6px] lg:border-t-0"
          : "mt-5 rounded-[22px] border border-(--t-border-line) bg-(--t-bg-deep) p-3 sm:p-4"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {compact ? (
          <SelectField
            appearance="pill"
            label={t("languages")}
            leading={<Icon icon="mdi:translate" width={19} />}
            value={
              current.languages?.length === 1
                ? current.languages[0]!
                : current.languages?.length
                  ? "selected"
                  : "all"
            }
            disabled={pending}
            onValueChange={(value) =>
              choose("languages", value === "all" ? [] : [value])
            }
            options={[
              { value: "all", label: t("allLanguages") },
              ...((current.languages?.length ?? 0) > 1
                ? [
                    {
                      value: "selected",
                      label: p("languageCount", {
                        count: current.languages!.length,
                      }),
                      disabled: true,
                    },
                  ]
                : []),
              ...languageValues.map((language) => ({
                value: language.value,
                label: languageName(language.value, [], locale),
              })),
            ]}
          />
        ) : null}
        {kind === "journal" && !compact && (
          <div
            role="group"
            aria-label={t("origins")}
            className="inline-flex max-w-full flex-wrap gap-1 rounded-[24px] p-1"
            style={{ borderColor: T.border.line, background: T.bg.muted }}
          >
            {[
              ["all", t("allStories")],
              ["community", t("communityJournal")],
              ["index", t("fromIndex")],
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
                className="min-h-11 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted2)"
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
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border bg-(--t-bg-deep) px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted) ${compact ? "h-[44px] min-h-[44px] text-[15px]" : ""}`}
              style={{ borderColor: T.border.hi }}
            >
              <Icon aria-hidden="true" icon="mdi:tune-variant" width={18} />
              {p("filters")}
              {chips.length ? ` · ${chips.length}` : ""}
            </button>
          </DialogTrigger>
          <DialogContent
            className="flex max-h-[min(90dvh,800px)] flex-col gap-0 overflow-hidden rounded-[28px] border-(--t-border-line) p-0 sm:max-w-3xl"
            closeButtonClassName="top-5 right-5 rounded-full"
            style={{ background: T.bg.deep, color: T.ink.base }}
          >
            <div className="shrink-0 border-b border-(--t-border-line) px-5 pt-6 pb-5 sm:px-7">
              <DialogTitle
                className="pr-10 text-[30px] font-medium"
                style={{ fontFamily: T.font.serif }}
              >
                {p("filters")}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[55ch] text-sm leading-relaxed text-(--t-ink-dim)">
                {p("filterLogic")}
              </DialogDescription>
              {compact && countrySuggestion}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] flex-1">
                  <SearchField
                    className="focus-within:ring-2 focus-within:ring-(--t-accent-primary) focus-within:ring-offset-2 [&_input:focus-visible]:outline-none!"
                    id="article-filter-search"
                    label={p("findFilter")}
                    placeholder={p("findFilter")}
                    onClear={() => setSearch("")}
                    inputProps={{
                      value: search,
                      onChange: (event) => setSearch(event.target.value),
                      autoComplete: "off",
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-(--t-accent-primary) transition-colors hover:bg-(--t-accent-chip)"
                  onClick={() => {
                    const next = clearArticleFacets(mobile ? staged : encoded)
                    if (mobile) setStaged(next.toString())
                    else navigate(next)
                  }}
                >
                  <Icon aria-hidden="true" icon="mdi:restart" width={17} />
                  {p("clearFilters")}
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain bg-(--t-bg-void) px-5 py-5 sm:px-7">
              <div className="grid items-start gap-4 sm:grid-cols-2">
                {keys.map((key) => {
                  const choices = (
                    key === "languages" ? languageValues : resolved.facets[key]
                  ).filter((facet) =>
                    facetLabel(key, facet)
                      .toLocaleLowerCase(locale)
                      .includes(search.toLocaleLowerCase(locale))
                  )
                  if (!choices.length && !current[key]?.length) return null

                  return (
                    <fieldset
                      key={key}
                      className="m-0 min-w-0 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-4"
                    >
                      <legend className="float-left mb-3 flex w-full items-center gap-2 p-0 text-sm font-semibold">
                        <Icon
                          aria-hidden="true"
                          icon={FACET_ICONS[key] ?? "mdi:tag-outline"}
                          width={18}
                          className="text-(--t-accent-primary)"
                        />
                        {t(key)}
                      </legend>
                      {(key === "languages" || key === "countries") && (
                        <button
                          type="button"
                          className="mb-2 inline-flex min-h-9 cursor-pointer items-center rounded-full bg-(--t-bg-muted) px-3 text-xs font-semibold text-(--t-accent-primary) hover:bg-(--t-accent-chip)"
                          onClick={() => choose(key, [])}
                        >
                          {t(
                            key === "languages"
                              ? "allLanguages"
                              : "allCountries"
                          )}
                        </button>
                      )}
                      {key === "languages" && (
                        <p
                          className="clear-both mt-0 mb-2 text-xs leading-relaxed"
                          style={{ color: T.ink.dim }}
                        >
                          {p("contentLanguageHint")}
                        </p>
                      )}
                      <div className="clear-both -mx-1 max-h-52 overflow-y-auto overscroll-contain px-1">
                        {choices.map((facet) => {
                          const checked = (current[key] ?? []).some((value) =>
                            articleFacetMatches(facet, value)
                          )

                          return (
                            <label
                              key={facet.value}
                              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-(--t-bg-muted) ${checked ? "bg-(--t-accent-chip)" : ""}`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  name={key}
                                  aria-label={`${facetLabel(key, facet)}${changingPreview ? "" : ` (${facet.count})`}`}
                                  className="size-4 shrink-0 cursor-pointer accent-(--t-accent-primary)"
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
                                <span>{facetLabel(key, facet)}</span>
                              </span>
                              {!changingPreview && (
                                <span
                                  aria-hidden="true"
                                  className="shrink-0 rounded-full bg-(--t-bg-muted) px-2 py-0.5 text-xs tabular-nums"
                                  style={{ color: T.ink.dim }}
                                >
                                  <span className="sr-only">(</span>
                                  {facet.count}
                                  <span className="sr-only">)</span>
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
              {!keys.some((key) =>
                (key === "languages"
                  ? languageValues
                  : resolved.facets[key]
                ).some((facet) =>
                  facetLabel(key, facet)
                    .toLocaleLowerCase(locale)
                    .includes(search.toLocaleLowerCase(locale))
                )
              ) && (
                <p
                  role="status"
                  className="m-0 py-8 text-center text-sm text-(--t-ink-dim)"
                >
                  {t("noFilterChoices")}
                </p>
              )}
            </div>
            <div className="shrink-0 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-7">
              {previewFailed && (
                <p role="status" className="mt-0 text-sm">
                  {p("countUnavailable")}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (mobile) navigate(new URLSearchParams(staged))
                  setOpen(false)
                }}
                className="min-h-12 w-full cursor-pointer rounded-full px-5 py-3 font-semibold transition-colors hover:bg-(--t-accent-primary-hover)"
                style={{ background: T.accent.primary, color: T.bg.deep }}
              >
                {changingPreview
                  ? p("showResults")
                  : p("showCount", { count: resolved.total })}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {!compact && countrySuggestion}
      </div>
      {chips.length > 0 ? (
        <ul
          aria-label={t("selectedFilters")}
          className="mt-3 mb-0 flex list-none flex-wrap gap-2 border-t border-(--t-border-line) pt-3 pl-0"
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
                className="min-h-9 cursor-pointer rounded-full px-3 py-1 text-sm hover:brightness-95"
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
      ) : kind === "journal" && !compact ? (
        <p
          className="mt-3 mb-0 text-xs leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          {t("worldwide")}
        </p>
      ) : null}
      {preferenceFailed && (
        <p role="status" className="text-sm">
          {t("preferenceFailed")}
        </p>
      )}
    </div>
  )
}
