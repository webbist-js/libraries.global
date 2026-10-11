"use client"

import { useId, useSyncExternalStore } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { formatCount } from "./location-page.helpers"

export type LocationChildItem = {
  slug: string
  name: string
  subtitle?: string | null
  href: string
  addHref?: string
  count: number
  shareCount?: number
  coverage?: string | null
}
const PAGE_SIZE = 20
const subscribe = (change: () => void) => {
  window.addEventListener("popstate", change)
  window.addEventListener("place-browser-change", change)

  return () => {
    window.removeEventListener("popstate", change)
    window.removeEventListener("place-browser-change", change)
  }
}
const snapshot = () => window.location.search
const serverSnapshot = () => ""

/** Bounded rows, honest share bars and separate discovery/contribution links. */
export function LocationChildBrowser({
  id,
  title,
  description,
  items,
  noun,
  addHref,
  countsAvailable = true,
  totalCount,
  shareLabel = "Share of documented place-based libraries",
  coverageLabel = "Sub-areas with records",
}: {
  readonly id: string
  readonly title: string
  readonly description?: string | null
  readonly items: LocationChildItem[]
  readonly noun: { singular: string; plural: string }
  readonly addHref: string
  readonly countsAvailable?: boolean
  readonly totalCount?: number
  readonly shareLabel?: string
  readonly coverageLabel?: string
}) {
  const inputId = useId()
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const params = new URLSearchParams(search)
  const query = params.get(`${id}_q`) ?? ""
  const populated = items.filter((item) => item.count > 0).length
  const empty = items.length - populated
  const rawView =
    params.get(`${id}_view`) ??
    (countsAvailable && populated && empty ? "populated" : "all")
  const sort = params.get(`${id}_sort`) ?? "count"
  const page = Math.max(1, Number(params.get(`${id}_page`)) || 1)
  const set = (key: string, value: string) => {
    const next = new URL(window.location.href)
    if (value) next.searchParams.set(`${id}_${key}`, value)
    else next.searchParams.delete(`${id}_${key}`)
    if (key !== "page") next.searchParams.delete(`${id}_page`)
    window.history.replaceState(null, "", next)
    window.dispatchEvent(new Event("place-browser-change"))
  }
  const view =
    (rawView === "empty" && empty) || (rawView === "populated" && populated)
      ? rawView
      : "all"
  const q = query.trim().toLocaleLowerCase()
  const matches = items
    .filter(
      (item) =>
        (!q ||
          `${item.name} ${item.subtitle ?? ""}`
            .toLocaleLowerCase()
            .includes(q)) &&
        (!countsAvailable ||
          view === "all" ||
          (view === "empty" ? item.count === 0 : item.count > 0))
    )
    .sort(
      (a, b) =>
        (sort === "name" || !countsAvailable ? 0 : b.count - a.count) ||
        a.name.localeCompare(b.name)
    )
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const preview =
    countsAvailable &&
    (view === "populated" || (view === "all" && empty === 0)) &&
    !q &&
    sort === "count" &&
    current === 1 &&
    params.get(`${id}_expanded`) !== "1" &&
    matches.length > 5
  const rows = preview
    ? matches.slice(0, 5)
    : matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const total = totalCount ?? items.reduce((sum, item) => sum + item.count, 0)
  const hasCoverage = items.some((item) => item.coverage != null)
  const columns = hasCoverage
    ? "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(100px,.8fr)_minmax(0,1.6fr)]"
    : "sm:grid-cols-[minmax(0,1.3fr)_minmax(100px,.8fr)_minmax(0,1.6fr)]"
  const tabs = [
    { value: "all", label: `All places · ${formatCount(items.length)}` },
    ...(countsAvailable && populated
      ? [
          {
            value: "populated",
            label: `With records · ${formatCount(populated)}`,
          },
        ]
      : []),
    ...(countsAvailable && empty
      ? [{ value: "empty", label: `No records yet · ${formatCount(empty)}` }]
      : []),
  ]

  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2
            id={`${id}-title`}
            className="m-0 text-[clamp(30px,4vw,44px)] leading-tight"
            style={{ fontFamily: T.font.serif }}
          >
            {title}
          </h2>
          {description ? (
            <p
              className="mt-3 max-w-[65ch] text-[15px] leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor={inputId}>
            Search {noun.plural}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => set("q", event.target.value)}
            placeholder={`Find a ${noun.singular.toLocaleLowerCase()}`}
            className="min-h-11 w-full rounded-full border bg-white px-4 text-sm sm:w-56"
            style={{ borderColor: T.border.hi }}
          />
        </div>
      </div>
      <div className="mt-5 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-[24px] p-1 sm:rounded-full"
          role="group"
          aria-label={`Filter ${noun.plural}`}
          style={{ background: T.bg.muted }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={view === tab.value}
              onClick={() => set("view", tab.value)}
              className="min-h-11 rounded-full px-4 text-sm font-semibold"
              style={{
                background: view === tab.value ? T.bg.deep : "transparent",
                color: T.ink.base,
                boxShadow:
                  view === tab.value
                    ? "0 1px 2px rgba(23,22,43,.1)"
                    : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="flex items-center gap-1 text-sm"
          role="group"
          aria-label={`Sort ${noun.plural}`}
          style={{ color: T.ink.dim }}
        >
          <span>Sort:</span>
          <button
            type="button"
            aria-pressed={sort === "count"}
            onClick={() => set("sort", "count")}
            className="min-h-11 px-1"
            style={{
              fontWeight: sort === "count" ? 600 : 400,
              color: sort === "count" ? T.ink.base : T.ink.dim,
            }}
          >
            Most records
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            aria-pressed={sort === "name"}
            onClick={() => set("sort", "name")}
            className="min-h-11 px-1"
            style={{
              fontWeight: sort === "name" ? 600 : 400,
              color: sort === "name" ? T.ink.base : T.ink.dim,
            }}
          >
            A–Z
          </button>
        </div>
      </div>
      {!countsAvailable ? (
        <p role="status" className="text-sm" style={{ color: T.ink.dim }}>
          Library counts are temporarily unavailable. You can still explore
          these places.
        </p>
      ) : null}
      <p
        aria-live="polite"
        className={preview && !q ? "sr-only" : "mt-4 mb-4 text-sm"}
        style={{ color: T.ink.dim }}
      >
        {formatCount(matches.length)}{" "}
        {matches.length === 1 ? noun.singular : noun.plural}
        {q ? ` matching "${query.trim()}"` : ""}
        {pages > 1 && !preview ? ` · Page ${current} of ${pages}` : ""}
      </p>
      <div
        className="overflow-hidden rounded-[22px] border bg-white"
        style={{ borderColor: T.border.line }}
      >
        {countsAvailable ? (
          <div
            className={
              "hidden gap-4 border-b px-[22px] py-3 text-[13px] font-semibold sm:grid " +
              columns
            }
            style={{
              background: T.bg.void,
              color: T.ink.dim,
              borderColor: T.border.line,
            }}
          >
            <span className="capitalize">{noun.singular}</span>
            {hasCoverage ? <span>{coverageLabel}</span> : null}
            <span className="text-right">Documented libraries</span>
            <span>{view === "empty" ? "Add a first record" : shareLabel}</span>
          </div>
        ) : null}
        <ul className="m-0 list-none divide-y p-0">
          {rows.map((item) => {
            const geographicCount = item.shareCount ?? item.count
            const share =
              total > 0 ? Math.min(100, (geographicCount / total) * 100) : 0

            return (
              <li
                key={item.slug}
                className={
                  "grid items-center gap-x-4 gap-y-2 px-[22px] py-0.5 " +
                  columns
                }
              >
                <div className="min-w-0">
                  <GlobalLink
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-[20px] leading-tight hover:underline"
                    style={{ fontFamily: T.font.serif }}
                  >
                    {item.name}
                  </GlobalLink>
                  {item.subtitle && !hasCoverage ? (
                    <p className="m-0 text-[12px]" style={{ color: T.ink.dim }}>
                      {item.subtitle}
                    </p>
                  ) : null}
                </div>
                {hasCoverage ? (
                  <span className="text-[14px]" style={{ color: T.ink.dim }}>
                    {item.coverage ?? "Unavailable"}
                  </span>
                ) : null}
                {countsAvailable ? (
                  <>
                    <span className="text-[15px] font-semibold tabular-nums sm:text-right">
                      {formatCount(item.count)}
                    </span>
                    {item.count > 0 ? (
                      <div>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="block h-2 flex-1 overflow-hidden rounded-full"
                            style={{ background: T.bg.muted }}
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: share + "%",
                                background: T.accent.primary,
                              }}
                            />
                          </span>
                          <span
                            className="w-12 text-right text-[13px] tabular-nums"
                            style={{ color: T.ink.dim }}
                          >
                            {share > 0 && share < 0.1
                              ? "<0.1"
                              : share.toLocaleString("en-GB", {
                                  maximumFractionDigits: 1,
                                })}
                            %
                          </span>
                        </div>
                        {!geographicCount ? (
                          <span
                            className="mt-1 block text-xs"
                            style={{ color: T.ink.dim }}
                          >
                            Digital records have no geographic share
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <GlobalLink
                        href={item.addHref ?? addHref}
                        aria-label={"Add the first library in " + item.name}
                        className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border px-3 text-[13px] font-semibold no-underline hover:bg-(--t-bg-surface)"
                        style={{ color: T.ink.base, borderColor: T.border.hi }}
                      >
                        Add a library
                      </GlobalLink>
                    )}
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
        {preview ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-[22px] py-3 text-[14px]"
            style={{ borderColor: T.border.line, color: T.ink.dim }}
          >
            <p className="m-0 flex-1">
              {matches
                .slice(5, 11)
                .map((item) => item.name + " " + formatCount(item.count))
                .join(" · ")}
              {matches.length > 11 ? ` · ${matches.length - 11} more` : ""}
            </p>
            <button
              type="button"
              className="min-h-11 font-semibold underline underline-offset-4"
              style={{ color: T.accent.primary }}
              onClick={() => set("expanded", "1")}
            >
              Show all {formatCount(matches.length)}
            </button>
          </div>
        ) : null}
      </div>
      {countsAvailable && populated > 0 && view !== "empty" ? (
        <p
          className="mt-4 text-[13px] leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          Bars show how this index’s place-based records are spread across
          places. They don’t measure how complete a place’s listing is.
        </p>
      ) : null}
      {countsAvailable && empty > 0 && view !== "empty" && !q ? (
        <div
          className="mt-6 rounded-[22px] p-6"
          style={{ background: T.bg.space }}
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1">
              <h3
                className="m-0 text-[28px] leading-tight"
                style={{ fontFamily: T.font.serif }}
              >
                {formatCount(empty)} {empty === 1 ? noun.singular : noun.plural}{" "}
                with no documented libraries yet
              </h3>
              <p
                className="mt-1.5 mb-0 text-[15px] leading-[1.55]"
                style={{ color: T.ink.dim }}
              >
                No one has added a library here yet — it doesn’t mean there are
                none. Open a {noun.singular.toLocaleLowerCase()} to explore it,
                or add the first library.
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 shrink-0 text-sm font-semibold underline underline-offset-3"
              style={{ color: T.accent.primary }}
              onClick={() => set("view", "empty")}
            >
              Show all {formatCount(empty)}
            </button>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {items
              .filter((item) => !item.count)
              .slice(0, 8)
              .map((item) => (
                <li
                  key={item.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[14px] px-3 py-2.5"
                  style={{ background: T.bg.deep }}
                >
                  <GlobalLink
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-3"
                    style={{ color: T.ink.base }}
                  >
                    {item.name}
                  </GlobalLink>
                  <GlobalLink
                    href={item.addHref ?? addHref}
                    aria-label={"Add the first library in " + item.name}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border px-3 text-[13px] font-semibold no-underline hover:bg-(--t-bg-surface)"
                    style={{ color: T.ink.base, borderColor: T.border.hi }}
                  >
                    Add a library
                  </GlobalLink>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {!rows.length ? (
        <p className="py-4">
          No {noun.plural} match this filter.{" "}
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => {
              set("q", "")
              set("view", "all")
            }}
          >
            Clear filters
          </button>
        </p>
      ) : null}
      {pages > 1 && !preview ? (
        <nav aria-label={`${title} pages`} className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={current === 1}
            className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
            onClick={() => set("page", String(current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={current === pages}
            className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
            onClick={() => set("page", String(current + 1))}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  )
}
