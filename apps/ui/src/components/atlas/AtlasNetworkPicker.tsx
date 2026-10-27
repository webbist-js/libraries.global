"use client"

import type { AtlasNetworkPage, AtlasNetworkSelection } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds/SearchField"
import { SelectField } from "@/components/ds/SelectField"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { Icon } from "./atlas-ui"

function useNetworkPage(params: Record<string, string>, enabled: boolean) {
  const key = new URLSearchParams(params).toString()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{
    key: string
    data?: AtlasNetworkPage
    error?: boolean
  } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/atlas/networks?${key}`, {
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Service search unavailable")
          const data: AtlasNetworkPage = await response.json()
          setState({ key, data })
        })
        .catch(() => {
          if (!abort.signal.aborted) setState({ key, error: true })
        })
    }, 200)

    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [key, enabled, revision])

  return {
    previous: state?.data,
    data: state?.key === key ? state.data : null,
    error: state?.key === key && state.error,
    retry: () => {
      setState(null)
      setRevision((value) => value + 1)
    },
  }
}

export function useAtlasNetworkSelection(id: string) {
  const page = useNetworkPage({ selected: id }, Boolean(id))

  return {
    selected: id ? (page.data?.selected ?? null) : null,
    loading: Boolean(id) && !page.data && !page.error,
    error: page.error,
    retry: page.retry,
  }
}

/** Search is paged on the server; geography filters belong to this picker only. */
export function AtlasNetworkPicker({
  value,
  selected,
  onChange,
  compact = false,
}: {
  readonly value: string
  readonly selected: AtlasNetworkSelection | null
  readonly onChange: (id: string) => void
  readonly compact?: boolean
}) {
  const t = useTranslations("atlasNetwork")
  const id = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("")
  const [region, setRegion] = useState("")
  const [cursors, setCursors] = useState<string[]>([])
  const page = useNetworkPage(
    { q: query, country, region, after: cursors.at(-1) ?? "" },
    open
  )
  const data = page.data
  const facets = data ?? page.previous
  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {!compact ? (
        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-(--t-ink-dim)">
          <span>{t("networkLabel")}</span>
          {value ? (
            <button
              type="button"
              className="min-h-8 underline underline-offset-2"
              onClick={() => onChange("")}
            >
              {t("clearService")}
            </button>
          ) : null}
        </div>
      ) : null}
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("chooseNetwork")}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-(--t-border-hi) bg-(--t-bg-surface) px-3.5 py-3 text-left text-sm text-(--t-ink-base) hover:bg-(--t-bg-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
          >
            {!compact ? <Icon name="book" size={18} /> : null}
            <span className="min-w-0 flex-1">
              {selected?.name ?? t("chooseNetwork")}
            </span>
            {showChangeService(compact, selected) ? (
              <span className="shrink-0 text-xs font-medium text-(--t-ink-dim)">
                {t("changeService")}
              </span>
            ) : null}
            <Icon name="chevD" size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={t("findService")}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
          className="z-[90] flex max-h-[calc(100dvh-32px)] w-[min(360px,calc(100vw-32px))] flex-col gap-3 overflow-y-auto rounded-2xl border-(--t-border-hi) bg-(--t-bg-deep) p-4 text-(--t-ink-base) shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="type-h3 m-0">{t("findService")}</h3>
            <button
              type="button"
              aria-label={t("closePicker")}
              onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center rounded-full hover:bg-(--t-bg-muted)"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <SearchField
            id={id}
            inputRef={searchRef}
            size="sm"
            placeholder={t("searchServices")}
            onClear={() => {
              setQuery("")
              setCursors([])
            }}
            inputProps={{
              value: query,
              maxLength: 80,
              onChange: (event) => {
                setQuery(event.target.value)
                setCursors([])
              },
            }}
          />
          {compact && value ? (
            <button
              type="button"
              onClick={() => choose("")}
              className="min-h-10 self-start text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              {t("clearService")}
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label={t("countryFilter")}
              value={country}
              onValueChange={(value) => {
                setCountry(value)
                setRegion("")
                setCursors([])
              }}
              options={[
                { value: "", label: t("allCountries") },
                ...(facets?.countries ?? []).map((country) => ({
                  value: country.documentId,
                  label: country.name,
                })),
              ]}
            />
            <SelectField
              label={t("regionFilter")}
              disabled={!country || !data}
              value={region}
              onValueChange={(value) => {
                setRegion(value)
                setCursors([])
              }}
              options={[
                { value: "", label: t("allRegions") },
                ...(facets?.regions ?? []).map((region) => ({
                  value: region.documentId,
                  label: region.name,
                })),
              ]}
            />
          </div>
          <div aria-live="polite" className="text-xs text-(--t-ink-dim)">
            {page.error
              ? t("catalogueUnavailable")
              : !data
                ? t("searching")
                : t("servicesShown", { count: data.networks.length })}
          </div>
          {page.error ? (
            <button
              type="button"
              onClick={() => page.retry()}
              className="min-h-11 rounded-full border px-4 font-semibold"
            >
              {t("retry")}
            </button>
          ) : null}
          <ul
            aria-label={t("networkLabel")}
            className="m-0 max-h-[min(320px,42vh)] list-none overflow-y-auto overscroll-contain p-0"
          >
            {data?.networks.map((network) => (
              <li key={network.documentId}>
                <button
                  type="button"
                  aria-pressed={value === network.documentId}
                  onClick={() => choose(network.documentId)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-(--t-accent-primary) aria-pressed:bg-(--t-accent-chip)"
                >
                  <span className="flex-1">{network.name}</span>
                  {value === network.documentId ? (
                    <Icon name="check" size={16} />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {data && !data.networks.length ? (
            <p className="m-0 text-sm text-(--t-ink-dim)">{t("noServices")}</p>
          ) : null}
          {data && (cursors.length > 0 || data.next) ? (
            <div className="flex justify-between gap-2 border-t border-(--t-divider) pt-2 text-sm font-semibold">
              <button
                type="button"
                disabled={!cursors.length}
                onClick={() => setCursors((values) => values.slice(0, -1))}
                className="min-h-10 rounded-full px-3 disabled:opacity-40"
              >
                {t("previousServices")}
              </button>
              <button
                type="button"
                disabled={!data.next}
                onClick={() => setCursors((values) => [...values, data.next!])}
                className="min-h-10 rounded-full px-3 disabled:opacity-40"
              >
                {t("nextServices")}
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function showChangeService(
  compact: boolean,
  selected: AtlasNetworkSelection | null
) {
  return compact && selected !== null
}
