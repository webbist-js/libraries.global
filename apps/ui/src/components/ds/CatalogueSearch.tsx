"use client"

import { Icon } from "@iconify/react"
import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds/SearchField"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Option = { documentId: string; name: string }
type Result<T> = { rows: T[]; more: boolean }

/** A focused, paginated catalogue search shared by Team and widget journeys. */
export function CatalogueSearch<T extends Option>({
  label,
  placeholder,
  disabled,
  load,
  describe,
  onSelect,
}: {
  readonly label: string
  readonly placeholder: string
  readonly disabled?: boolean
  readonly load: (
    query: string,
    page: number,
    signal: AbortSignal
  ) => Promise<Result<T>>
  readonly describe: (row: T) => string
  readonly onSelect: (row: T) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Result<T> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!open || disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setBusy(true)
      setError("")
      load(query, page, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setResult(value)
        })
        .catch((failure: Error) => {
          if (!controller.signal.aborted) setError(failure.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false)
        })
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, disabled, query, page, load, attempt])
  const search = (value: string) => {
    setQuery(value)
    setPage(1)
    setResult(null)
  }

  return (
    <div className="min-w-0 space-y-2">
      <p id={`${id}-label`} className="m-0 text-sm font-semibold">
        {label}
      </p>
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (value) search("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="surface"
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-prompt`}
            className="min-h-12 w-full justify-between rounded-xl px-4 text-left font-normal"
          >
            <span
              id={`${id}-prompt`}
              className="flex min-w-0 items-center gap-2 text-(--t-ink-dim)"
            >
              <Icon aria-hidden icon="mdi:magnify" width={19} />
              {placeholder}
            </span>
            <Icon aria-hidden icon="mdi:chevron-down" width={18} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={`Search ${label.toLowerCase()}`}
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-[100] max-h-(--radix-popover-content-available-height) w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-2xl border-(--t-border-line) bg-(--t-bg-deep) p-3 text-(--t-ink-base) shadow-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            input.current?.focus()
          }}
        >
          <SearchField
            id={`${id}-query`}
            inputRef={input}
            placeholder={placeholder}
            loading={busy}
            onClear={() => search("")}
            inputProps={{
              value: query,
              onChange: (event) => search(event.target.value),
              maxLength: 120,
              autoComplete: "off",
              onKeyDown: (event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  document.getElementById(`${id}-first`)?.focus()
                }
              },
            }}
          />
          <div role="status" className="px-2 py-3 text-xs text-(--t-ink-dim)">
            {busy || (!result && !error)
              ? "Finding matches…"
              : error
                ? "Search unavailable"
                : `${result?.rows.length ?? 0} results · Page ${page}`}
          </div>
          {error ? (
            <div role="alert" className="p-3 text-sm">
              <p>{error}</p>
              <Button
                variant="surface"
                size="pill"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Try again
              </Button>
            </div>
          ) : null}
          <ul
            aria-label={label}
            aria-busy={busy}
            className="m-0 max-h-72 list-none space-y-1 overflow-y-auto p-0"
          >
            {!error &&
              result?.rows.map((row, index) => (
                <li key={row.documentId}>
                  <button
                    id={index === 0 ? `${id}-first` : undefined}
                    type="button"
                    disabled={disabled || busy}
                    className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
                    onClick={() => {
                      onSelect(row)
                      setOpen(false)
                    }}
                    onKeyDown={(event) => {
                      const item = event.currentTarget.closest("li")
                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        item?.nextElementSibling
                          ?.querySelector("button")
                          ?.focus()
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault()
                        const previous =
                          item?.previousElementSibling?.querySelector("button")
                        if (previous) previous.focus()
                        else input.current?.focus()
                      }
                    }}
                  >
                    <span className="min-w-0">
                      <strong className="block text-sm">{row.name}</strong>
                      <span className="mt-1 block text-xs text-(--t-ink-dim)">
                        {describe(row)}
                      </span>
                    </span>
                    <Icon
                      aria-hidden
                      icon="mdi:arrow-right"
                      width={18}
                      className="shrink-0 text-(--t-accent-primary)"
                    />
                  </button>
                </li>
              ))}
          </ul>
          {result && !result.rows.length && !busy && !error ? (
            <p className="px-3 py-6 text-sm text-(--t-ink-dim)">
              No matches. Try another name or a broader search.
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between border-t border-(--t-border-line) pt-3">
            <Button
              variant="surface"
              size="pill"
              disabled={disabled || page === 1 || busy}
              onClick={() => {
                setPage((n) => n - 1)
                setResult(null)
              }}
            >
              Previous
            </Button>
            <Button variant="link" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="surface"
              size="pill"
              disabled={disabled || !result?.more || busy}
              onClick={() => {
                setPage((n) => n + 1)
                setResult(null)
              }}
            >
              Next
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
