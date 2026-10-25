"use client"

import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds/SearchField"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AtlasContextArea } from "@/lib/atlas-context"

import { Icon } from "./atlas-ui"

export interface AtlasAreaChoice {
  id: string
  name: string
  detail?: string
  area?: AtlasContextArea
}

/** The population catalogue is bounded; small-area catalogues are searched server-side. */
export function AtlasAreaPicker({
  selected,
  onSelect,
  areas,
  release,
}: {
  readonly selected: AtlasAreaChoice | null
  readonly onSelect: (area: AtlasAreaChoice) => void
  readonly areas?: readonly AtlasAreaChoice[]
  readonly release?: string
}) {
  const t = useTranslations("atlasContext")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    key: string
    areas?: AtlasAreaChoice[]
    total?: number
    next?: number | null
    error?: boolean
  } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const key = `${release}:${query}:${offset}:${revision}`
  useEffect(() => {
    if (!open || !release) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        kind: "search",
        release,
        q: query,
        offset: String(offset),
      })
      fetch(`/api/atlas/context?${params}`, {
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Area search unavailable")
          const value = await response.json()
          if (!Array.isArray(value.areas) || value.areas.length > 30)
            throw new Error("Invalid area page")
          if (!abort.signal.aborted)
            setResult({
              key,
              areas: value.areas.map(areaChoice),
              total: value.total,
              next: value.next,
            })
        })
        .catch(() => {
          if (!abort.signal.aborted) setResult({ key, error: true })
        })
    }, 200)

    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [open, release, query, offset, key])
  const matching = areas?.filter((a) =>
    `${a.name} ${a.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )
  const current = release
    ? result?.key === key
      ? result
      : null
    : {
        error: false,
        areas: matching?.slice(offset, offset + 30),
        total: matching?.length,
        next: offset + 30 < (matching?.length ?? 0) ? offset + 30 : null,
      }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-(--t-ink-dim)">
        {t("area")}
      </span>
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("chooseArea")}
            className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-2 text-left font-semibold text-(--t-ink-base) focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
          >
            <Icon name="search" size={17} />
            <span className="min-w-0 flex-1">
              {selected?.name ?? t("chooseArea")}
            </span>
            <Icon name="chevD" size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            input.current?.focus()
          }}
          className="z-[90] flex max-h-[min(540px,calc(100dvh-32px))] w-[min(360px,calc(100vw-32px))] flex-col gap-3 overflow-auto rounded-2xl bg-(--t-bg-deep) p-4 text-(--t-ink-base)"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-base font-semibold">{t("findArea")}</h3>
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center rounded-full hover:bg-(--t-bg-muted)"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <SearchField
            id={id}
            inputRef={input}
            size="sm"
            placeholder={t("searchAreas")}
            onClear={() => {
              setQuery("")
              setOffset(0)
            }}
            inputProps={{
              value: query,
              maxLength: 80,
              onChange: (e) => {
                setQuery(e.target.value)
                setOffset(0)
              },
            }}
          />
          <div role="status" className="text-xs text-(--t-ink-dim)">
            {current?.error
              ? t("searchUnavailable")
              : !current?.areas
                ? t("searching")
                : t("areaMatches", { count: current.total ?? 0 })}
          </div>
          {current?.error ? (
            <button
              type="button"
              className="min-h-11 underline"
              onClick={() => setRevision((n) => n + 1)}
            >
              {t("retry")}
            </button>
          ) : null}
          <div className="flex flex-col gap-1">
            {current?.areas?.map((area) => (
              <button
                key={area.id}
                type="button"
                aria-pressed={selected?.id === area.id}
                onClick={() => {
                  onSelect(area)
                  setOpen(false)
                }}
                className="min-h-11 rounded-lg px-3 py-2 text-left hover:bg-(--t-bg-muted) aria-pressed:bg-(--t-bg-muted)"
              >
                <span className="block font-semibold">{area.name}</span>
                <span className="text-xs text-(--t-ink-dim)">
                  {area.detail ?? area.id}
                </span>
              </button>
            ))}
          </div>
          {offset > 0 || current?.next != null ? (
            <div className="flex justify-between gap-2 border-t border-(--t-divider) pt-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 30))}
                className="min-h-11 disabled:opacity-40"
              >
                {t("previous")}
              </button>
              <button
                type="button"
                disabled={current?.next == null}
                onClick={() => setOffset(current!.next!)}
                className="min-h-11 disabled:opacity-40"
              >
                {t("next")}
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function areaChoice(area: AtlasContextArea): AtlasAreaChoice {
  return { id: area.code, name: area.name, detail: area.code, area }
}
