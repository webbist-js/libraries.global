"use client"

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  useCallback,
  useId,
  type ReactNode,
} from "react"

import { CatalogueSearch } from "@/components/ds/CatalogueSearch"
import { Notice } from "@/components/ds/Notice"
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
  const load = useCallback(
    async (query: string, page: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        kind,
        q: query,
        page: String(page),
        ...(country ? { country } : {}),
      })

      return widgetRequest<CataloguePage>(
        teamId,
        `/catalogue?${params}`,
        "GET",
        undefined,
        signal
      )
    },
    [teamId, kind, country]
  )

  return (
    <CatalogueSearch
      label={label}
      placeholder={`Search ${kind}`}
      disabled={disabled}
      load={load}
      describe={(row: CatalogueOption) =>
        [
          row.kind?.replaceAll("_", " "),
          row.city,
          row.libraryCount !== undefined
            ? `${row.libraryCount} published ${row.libraryCount === 1 ? "library" : "libraries"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      }
      onSelect={onPick}
    />
  )
}
