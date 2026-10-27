"use client"

import { Icon } from "@iconify/react"
import type { SupportersResponse } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useRef, useState, useTransition, type FormEvent } from "react"

import { Avatar } from "@/components/ds/Avatar"
import { EmptyState } from "@/components/ds/EmptyState"
import { SearchField } from "@/components/ds/SearchField"
import { SelectField } from "@/components/ds/SelectField"
import GlobalLink from "@/components/global/GlobalLink"
import {
  supportersHref,
  supportersParams,
  type SupportersQuery,
} from "@/lib/community/supporters"
import { T, type TypeTintKey } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

const REGIONS = [
  ["", "Everywhere"],
  ["europe", "Europe"],
  ["africa", "Africa"],
  ["asia", "Asia"],
  ["americas", "Americas"],
  ["oceania", "Oceania"],
] as const
const TINTS: TypeTintKey[] = [
  "national",
  "public",
  "academic",
  "special",
  "neutral",
]

function countryName(country: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(
        country.toUpperCase()
      ) ?? country
    )
  } catch {
    return country
  }
}

export function SupportersDirectory({
  data,
  query,
  locale,
}: {
  readonly data: SupportersResponse | null
  readonly query: SupportersQuery
  readonly locale: string
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const [sort, setSort] = useState(query.sort ?? "longest")
  const [directory, setDirectory] = useState(data)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() =>
      router.push(
        supportersHref({
          ...query,
          q: String(form.get("q") ?? ""),
          sort: String(form.get("sort") ?? "longest"),
        })
      )
    )
  }

  async function showMore() {
    if (!directory || loadingMore) return
    setLoadingMore(true)
    setLoadError(false)
    try {
      const params = supportersParams({
        ...query,
        page: String(directory.page + 1),
      })
      const response = await fetch(`/api/supporters?${params}`, {
        cache: "no-store",
      })
      if (!response.ok) throw new Error("Supporters unavailable")
      const body = (await response.json()) as { data: SupportersResponse }
      setDirectory((current) =>
        current
          ? {
              ...body.data,
              entries: [
                ...new Map(
                  [...current.entries, ...body.data.entries].map((entry) => [
                    entry.username,
                    entry,
                  ])
                ).values(),
              ],
            }
          : body.data
      )
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section
      id="our-supporters"
      aria-labelledby="supporters-heading"
      className="scroll-mt-24"
      aria-busy={pending || loadingMore}
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 id="supporters-heading" className="type-h2 m-0">
            Our supporters
          </h2>
          {directory ? (
            <p className="mt-2 mb-0 text-sm" style={{ color: T.ink.dim }}>
              {directory.total.toLocaleString(locale)} supporters ·{" "}
              {directory.listed.toLocaleString(locale)} listed here
            </p>
          ) : null}
        </div>
        {directory ? (
          <form
            className="flex w-full flex-wrap items-center gap-3 md:w-auto"
            method="get"
            onSubmit={search}
            ref={formRef}
          >
            <SearchField
              id="supporters-search"
              placeholder={tUi("search_by_name_or_place")}
              size="sm"
              className="min-h-11 min-w-56 flex-1 rounded-xl md:w-60"
              inputProps={{
                name: "q",
                defaultValue: query.q ?? "",
                maxLength: 100,
                disabled: pending,
              }}
            />
            <label className="flex items-center gap-2 text-sm font-semibold">
              Sort
              <SelectField
                name="sort"
                label="Sort"
                value={sort}
                disabled={pending}
                className="w-auto font-normal"
                options={[
                  { value: "longest", label: "Longest supporting" },
                  { value: "newest", label: "Newest supporting" },
                  { value: "name", label: "Name A–Z" },
                ]}
                onValueChange={(value) => {
                  setSort(value)
                  const form = formRef.current && new FormData(formRef.current)
                  startTransition(() =>
                    router.push(
                      supportersHref({
                        ...query,
                        q: String(form?.get("q") ?? ""),
                        sort: value,
                      })
                    )
                  )
                }}
              />
            </label>
            <button type="submit" className="sr-only focus:not-sr-only">
              Search supporters
            </button>
          </form>
        ) : null}
      </div>
      {directory ? (
        <nav
          aria-label={tUi("supporters_by_continent")}
          className="mt-5 flex flex-wrap gap-2"
        >
          {REGIONS.map(([region, label]) => {
            const active = (query.region ?? "") === region

            return (
              <GlobalLink
                key={region}
                href={supportersHref({ ...query, country: undefined, region })}
                aria-current={active ? "page" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-semibold no-underline"
                style={{
                  background: active ? T.accent.chip : T.bg.deep,
                  borderColor: active ? T.accent.primary : T.border.hi,
                  color: active ? T.accent.primaryHover : T.ink.base,
                }}
              >
                {label}
              </GlobalLink>
            )
          })}
        </nav>
      ) : null}
      {directory ? (
        <div
          className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[22px] px-5 py-4"
          style={{ background: T.accent.chip }}
        >
          <span className="mr-1 text-sm font-semibold">New this month</span>
          {directory.newThisMonth?.length ? (
            directory.newThisMonth.map((entry) => (
              <GlobalLink
                key={entry.username}
                href={`/profile/${encodeURIComponent(entry.username)}`}
                className="rounded-full px-3 py-1 text-sm font-semibold no-underline"
                style={{ background: T.bg.deep, color: T.ink.base }}
              >
                {entry.displayName}
              </GlobalLink>
            ))
          ) : (
            <span className="text-sm" style={{ color: T.ink.dim }}>
              No new public supporters listed this month.
            </span>
          )}
        </div>
      ) : null}
      {!directory ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border p-6"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          The supporters list is unavailable. Please try again shortly.
        </p>
      ) : directory.entries.length === 0 ? (
        <EmptyState
          surface
          className="mt-6"
          icon="mdi:heart-outline"
          lead={
            directory.listed
              ? "No supporters match these filters."
              : "No public supporter profiles are listed yet."
          }
          detail={
            directory.listed
              ? undefined
              : "Thank you to everyone helping keep Libraries Global open."
          }
        />
      ) : (
        <ul className="mt-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {directory.entries.map((entry, index) => (
            <li key={entry.username}>
              <GlobalLink
                href={`/profile/${encodeURIComponent(entry.username)}`}
                className="flex h-full items-center gap-3 rounded-[22px] border p-4 no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{
                  background: T.bg.deep,
                  borderColor: T.border.line,
                  color: T.ink.base,
                }}
              >
                <Avatar
                  variant="tint"
                  tint={TINTS[index % TINTS.length]}
                  initials={entry.initials}
                  size="lg"
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-semibold">
                    {entry.displayName}
                  </span>
                  {entry.city || entry.country ? (
                    <span
                      className="mt-1 block text-sm leading-snug"
                      style={{ color: T.ink.dim }}
                    >
                      {[
                        entry.city,
                        entry.country
                          ? countryName(entry.country, locale)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  ) : null}
                  <span
                    className="mt-1 block text-xs leading-snug font-semibold"
                    style={{ color: T.accent.primary }}
                  >
                    {entry.since
                      ? `Supporter since ${new Date(entry.since).getUTCFullYear()}`
                      : tUi("supporter")}
                  </span>
                </span>
              </GlobalLink>
            </li>
          ))}
        </ul>
      )}
      {directory ? (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"
          style={{ color: T.ink.dim }}
        >
          <p className="m-0 inline-flex items-center gap-2">
            <Icon
              icon="mdi:lock-outline"
              width={16}
              height={16}
              aria-hidden="true"
            />
            Plus {directory.unlisted.toLocaleString(locale)} supporters whose
            profiles are not listed.
          </p>
          {directory.page * directory.pageSize < directory.matched ? (
            <button
              type="button"
              onClick={() => void showMore()}
              disabled={loadingMore || pending}
              className="min-h-11 cursor-pointer rounded-full border px-5 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
              style={{
                background: T.bg.deep,
                borderColor: T.border.hi,
                color: T.ink.base,
              }}
            >
              {loadingMore ? tUi("loading") : "Show more"}
            </button>
          ) : null}
          {loadError ? (
            <p role="alert" className="m-0 basis-full">
              Couldn&apos;t load more supporters. Please try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
