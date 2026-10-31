"use client"

import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

import { Icon } from "./atlas-ui"
import type { LoosenSuggestion } from "./atlas.logic"

export function AtlasLoading({
  listReady,
  onOpenList,
}: {
  readonly listReady: boolean
  readonly onOpenList: () => void
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border bg-(--t-bg-deep) px-4 py-3.5 sm:gap-4"
      style={{ borderColor: T.border.line }}
      role="status"
      aria-busy="true"
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-[22px] shrink-0 rounded-full border-[3px] motion-safe:animate-spin"
          style={{
            borderColor: T.accent.chip,
            borderTopColor: T.accent.primary,
          }}
        />
        <span>
          <strong className="block">{tUi("loading_map")}</strong>
          <span className="text-sm" style={{ color: T.ink.dim }}>
            {listReady ? tUi("library_list_ready") : tUi("fetching_libraries")}
          </span>
        </span>
      </span>
      {listReady ? (
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-(--t-bg-deep) px-3.5 text-sm font-semibold"
          style={{ borderColor: T.border.hi }}
        >
          <Icon name="list" size={15} />
          {tUi("open_list")}
        </button>
      ) : null}
    </div>
  )
}

export function AtlasNoMatch({
  filterCount,
  suggestions,
  onApply,
  onClear,
}: {
  readonly filterCount: number
  readonly suggestions: LoosenSuggestion[]
  readonly onApply: (s: LoosenSuggestion) => void
  readonly onClear: () => void
}) {
  return (
    <div
      className="w-[min(440px,calc(100vw-32px))] rounded-[22px] border bg-(--t-bg-deep) p-[22px]"
      style={{ borderColor: T.border.hi }}
      role="status"
    >
      <h2 className="type-h2 m-0">
        No libraries match{" "}
        {filterCount === 1 ? "this filter" : `all ${filterCount} filters`}
      </h2>
      <p
        className="mt-2 mb-3.5 text-base leading-normal"
        style={{ color: "var(--t-ink-dim)" }}
      >
        {suggestions.length > 0
          ? "Try loosening one. Each suggestion shows how many libraries it would bring back."
          : "Try clearing the filters to see every library."}
      </p>
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onApply(s)}
            className="flex h-11 items-center justify-between rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold"
            style={{ borderColor: T.border.hi }}
          >
            {s.label}
            <strong style={{ color: T.accent.ok }}>
              +{s.gain.toLocaleString()}
            </strong>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-sm font-semibold underline underline-offset-[3px]"
        style={{ color: "var(--t-accent-primary-hover)" }}
      >
        Clear all filters
      </button>
    </div>
  )
}

export function AtlasBanner({
  tone,
  title,
  body,
  action,
}: {
  readonly tone: "danger" | "info"
  readonly title: string
  readonly body: string
  readonly action?: { label: string; onClick: () => void }
}) {
  const danger = tone === "danger"

  return (
    <div
      className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-[18px] border px-4 py-3.5 sm:flex sm:items-center"
      style={{
        background: danger ? "var(--t-palette-coral-bg)" : T.bg.deep,
        borderColor: danger ? T.edge.danger : T.border.hi,
        color: danger ? "var(--t-palette-coral-fg)" : T.ink.base,
      }}
      role={danger ? "alert" : "status"}
    >
      <Icon
        name={danger ? "off" : "info"}
        size={20}
        color={danger ? T.accent.danger : "var(--t-palette-blue-fg)"}
      />
      <span className="flex-1 text-base leading-snug">
        <strong>{title}</strong> {body}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="col-start-2 inline-flex min-h-11 shrink-0 items-center justify-self-start rounded-full border bg-(--t-bg-deep) px-3.5 text-sm font-semibold"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export function AtlasToast({
  children,
  onDismiss,
  action,
}: {
  readonly children: React.ReactNode
  readonly onDismiss: () => void
  readonly action?: { label: string; onClick: () => void }
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div
      className="flex items-center gap-3 rounded-full border bg-(--t-bg-deep) py-2 pr-2.5 pl-4 text-sm font-semibold"
      style={{ borderColor: T.border.hi }}
      role="status"
    >
      {children}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="text-sm font-semibold underline underline-offset-[3px]"
          style={{ color: "var(--t-accent-primary-hover)" }}
        >
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={tUi("dismiss")}
        onClick={onDismiss}
        className="flex size-8 items-center justify-center rounded-full"
        style={{ color: T.ink.dim }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
