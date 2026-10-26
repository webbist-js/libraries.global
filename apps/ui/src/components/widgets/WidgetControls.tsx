"use client"

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react"

import { Notice } from "@/components/ds/Notice"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/useMounted"
import {
  widgetRequest,
  type CatalogueOption,
  type CataloguePage,
} from "@/lib/widgets/client"

export function WidgetError({ error }: { readonly error: string | null }) {
  return error ? (
    <div role="alert">
      <Notice
        icon="mdi:alert-circle-outline"
        tone="warn"
        title="Couldn't complete that request"
      >
        <p className="m-0">{error}</p>
      </Notice>
    </div>
  ) : null
}
export function WidgetField({
  label,
  children,
  hint,
}: {
  readonly label: string
  readonly children: ReactNode
  readonly hint?: string
}) {
  const ready = useMounted()
  const generated = useId()
  const child = isValidElement(children)
    ? (children as ReactElement<{
        id?: string
        name?: string
        disabled?: boolean
        autoComplete?: string
        "aria-describedby"?: string
      }>)
    : null
  const id = child?.props.id ?? generated

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-sm text-(--t-ink-dim)">
          {hint}
        </p>
      ) : null}
      {child
        ? cloneElement(child, {
            id,
            disabled: child.props.disabled || !ready,
            name:
              child.props.name ??
              label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
            autoComplete: child.props.autoComplete ?? "off",
            "aria-describedby": hint
              ? `${id}-hint`
              : child.props["aria-describedby"],
          })
        : children}
    </div>
  )
}
export function CataloguePicker({
  teamId,
  kind,
  label,
  onPick,
  country,
  disabled = false,
}: {
  readonly teamId: string
  readonly kind: "networks" | "libraries" | "countries" | "regions"
  readonly label: string
  readonly onPick: (row: CatalogueOption) => void
  readonly country?: string
  readonly disabled?: boolean
}) {
  const ready = useMounted()
  const id = useId(),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<CataloguePage | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open || disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setBusy(true)
      setError(null)
      const params = new URLSearchParams({
        kind,
        q,
        page: String(page),
        ...(country ? { country } : {}),
      })
      widgetRequest<CataloguePage>(
        teamId,
        `/catalogue?${params}`,
        "GET",
        undefined,
        controller.signal
      )
        .then(setData)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false)
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [teamId, kind, q, page, country, open, disabled])

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={STAFF_FIELD}
        disabled={disabled || !ready}
        value={q}
        placeholder={`Search ${kind}`}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
          setOpen(true)
        }}
        aria-controls={open ? `${id}-results` : undefined}
        name={`${kind}-search`}
        autoComplete="off"
      />
      {open ? (
        <div
          id={`${id}-results`}
          className="space-y-2 rounded-2xl border border-(--t-border-line) bg-white p-3"
        >
          <p role="status" className="text-sm">
            {busy
              ? "Searching…"
              : data
                ? `${data.rows.length} results on page ${page}`
                : "Search the catalogue"}
          </p>
          <WidgetError error={error} />
          <ul className="m-0 list-none space-y-1 p-0">
            {data?.rows.map((row) => (
              <li key={row.documentId}>
                <button
                  className="flex min-h-11 w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-(--t-bg-surface) focus-visible:outline-2"
                  type="button"
                  onClick={() => {
                    onPick(row)
                    setOpen(false)
                    setQ("")
                  }}
                >
                  <strong className="text-sm">{row.name}</strong>
                  <span className="text-xs text-(--t-ink-dim)">
                    {[
                      row.kind?.replaceAll("_", " "),
                      row.city,
                      row.libraryCount !== undefined
                        ? `${row.libraryCount} published libraries`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data && !data.rows.length && !busy ? (
            <p className="text-sm">No matches. Try another name.</p>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button
              variant="surface"
              size="pill"
              disabled={page <= 1 || busy}
              onClick={() => setPage((n) => n - 1)}
            >
              Previous
            </Button>
            <Button
              variant="link"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="surface"
              size="pill"
              disabled={!data?.more || busy}
              onClick={() => setPage((n) => n + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
