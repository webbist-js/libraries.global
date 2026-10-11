"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useMemo, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { countNoun, formatCount } from "./location-page.helpers"

export type LocationChildItem = {
  slug: string
  name: string
  /** Capital city, region type… */
  subtitle?: string | null
  href: string
  count: number
}

type SortMode = "count" | "name"

// Empty-location chips shown before "Show all" when not filtering.
const EMPTY_PREVIEW = 30

const byName = (a: LocationChildItem, b: LocationChildItem) =>
  a.name.localeCompare(b.name, "en-GB")

/**
 * The child-location section of a continent or country page: a filterable,
 * sortable grid of count cards for places with libraries, then a chip list
 * of places with none yet.
 */
export function LocationChildBrowser({
  id,
  title,
  description,
  items,
  noun,
  addHref,
}: {
  readonly id: string
  /** Section title, e.g. "Countries". */
  readonly title: string
  readonly description?: string | null
  readonly items: LocationChildItem[]
  /** e.g. { singular: "country", plural: "countries" } */
  readonly noun: { singular: string; plural: string }
  readonly addHref: string
}) {
  const tUi = useUiTranslations("ui")

  const inputId = useId()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortMode>("count")
  const [showAllEmpty, setShowAllEmpty] = useState(false)

  const q = query.trim().toLocaleLowerCase("en-GB")
  const matches = (item: LocationChildItem) =>
    !q ||
    item.name.toLocaleLowerCase("en-GB").includes(q) ||
    Boolean(item.subtitle?.toLocaleLowerCase("en-GB").includes(q))

  const { populated, empty, max } = useMemo(() => {
    const withLibraries = items.filter((i) => i.count > 0)

    return {
      populated: withLibraries,
      empty: items.filter((i) => i.count === 0).sort(byName),
      max: Math.max(1, ...withLibraries.map((i) => i.count)),
    }
  }, [items])

  const shown = populated
    .filter(matches)
    .sort(
      sort === "name" ? byName : (a, b) => b.count - a.count || byName(a, b)
    )
  const emptyShown = empty.filter(matches)
  const emptyVisible =
    q || showAllEmpty ? emptyShown : emptyShown.slice(0, EMPTY_PREVIEW)

  const plural = (n: number) => countNoun(n, noun.singular, noun.plural)
  const status = q
    ? shown.length + emptyShown.length === 0
      ? `No ${noun.plural} match “${query.trim()}”`
      : `${formatCount(shown.length)} of ${formatCount(populated.length)} ${plural(populated.length)} with libraries match “${query.trim()}”`
    : populated.length === 0
      ? `No ${noun.plural} have libraries documented yet`
      : `${formatCount(populated.length)} ${plural(populated.length)} ${populated.length === 1 ? "has" : "have"} libraries documented`

  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="max-w-[62ch]">
          <h2
            id={`${id}-title`}
            className="m-0 text-[clamp(32px,4vw,44px)] leading-[1.05] tracking-[-0.01em]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            {title}
          </h2>
          {description ? (
            <p
              className="mt-2.5 mb-0 text-[15px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {description}
            </p>
          ) : null}
        </div>

        {items.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <label htmlFor={inputId} className="sr-only">
                {tUi("filter")} {noun.plural}
              </label>
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
                height={16}
                icon="mdi:magnify"
                style={{ color: T.ink.low }}
                width={16}
              />
              <input
                id={inputId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${noun.plural}`}
                autoComplete="off"
                className="h-10 w-[220px] rounded-[14px] border bg-white pr-3 pl-9 text-[14.5px] placeholder:text-(--t-ink-low)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              />
            </div>

            <fieldset
              className="m-0 flex rounded-full border-0 p-1"
              style={{ background: T.bg.muted2 }}
            >
              <legend className="sr-only">Sort {noun.plural}</legend>
              {(
                [
                  ["count", "Most libraries"],
                  ["name", "A–Z"],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-sort`}
                    value={value}
                    checked={sort === value}
                    onChange={() => setSort(value)}
                    className="peer sr-only"
                  />
                  <span className="block rounded-full border border-transparent px-3.5 py-1.5 text-[13.5px] font-semibold text-(--t-ink-dim) peer-checked:border-(--t-border-line) peer-checked:bg-white peer-checked:text-(--t-ink-base) peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--t-accent-primary)">
                    {text}
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        ) : null}
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          aria-live="polite"
          className="m-0 flex items-center gap-2 text-[14px] font-semibold"
          style={{ color: T.ink.base }}
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: T.accent.primary }}
          />
          {status}
        </p>
        {q ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-[13.5px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Clear filter
          </button>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((item) => (
            <li key={item.slug} className="flex">
              <CountCard item={item} max={max} />
            </li>
          ))}
        </ul>
      ) : null}

      {emptyShown.length > 0 ? (
        <div
          className="mt-4 rounded-[20px] px-5 py-4"
          style={{ background: T.bg.deep, border: `1px dashed ${T.border.hi}` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              className="m-0 flex items-center gap-2 text-[14px] font-semibold"
              style={{ color: T.ink.base }}
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full border-[1.5px]"
                style={{ borderColor: T.ink.low }}
              />
              No libraries documented yet
              <span style={{ color: T.ink.dim }}>
                · {formatCount(emptyShown.length)}
              </span>
            </h3>
            <GlobalLink
              href={addHref}
              className="text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Add the first one
            </GlobalLink>
          </div>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
            {emptyVisible.map((item) => (
              <li key={item.slug}>
                <GlobalLink
                  href={addHref}
                  aria-label={`Add a library in ${item.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[13.5px] font-semibold transition-colors hover:border-(--t-accent-primary)"
                  style={{ borderColor: T.border.line, color: T.ink.base }}
                >
                  {item.name}
                  <Icon
                    aria-hidden="true"
                    height={13}
                    icon="mdi:plus"
                    style={{ color: T.accent.primary }}
                    width={13}
                  />
                </GlobalLink>
              </li>
            ))}
          </ul>
          {!q && !showAllEmpty && emptyShown.length > EMPTY_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAllEmpty(true)}
              className="mt-3 text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Show all {formatCount(emptyShown.length)}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function CountCard({
  item,
  max,
}: {
  readonly item: LocationChildItem
  readonly max: number
}) {
  const share = Math.max(4, Math.round((item.count / max) * 100))

  return (
    <GlobalLink
      href={item.href}
      className="flex w-full flex-col gap-3 rounded-2xl border bg-white px-4 pt-3.5 pb-4 transition-[border-color,box-shadow] hover:border-(--t-border-hi) hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"
      style={{ borderColor: T.border.line }}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span
            className="block text-[19px] leading-[1.15]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            {item.name}
          </span>
          {item.subtitle ? (
            <span
              className="mt-1 block text-[12.5px] leading-[1.35]"
              style={{ color: T.ink.dim }}
            >
              {item.subtitle}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className="text-[24px] leading-none"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            {formatCount(item.count)}
          </span>
          <span className="mt-1 text-[11.5px]" style={{ color: T.ink.dim }}>
            {countNoun(item.count, "library", "libraries")}
          </span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className="mt-auto block h-1 overflow-hidden rounded-full"
        style={{ background: T.bg.muted }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${share}%`, background: T.accent.primary }}
        />
      </span>
    </GlobalLink>
  )
}
